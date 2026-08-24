import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createPublicKey, type KeyObject } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { UsersService } from '../../users/users.service';
import { extractBearerToken } from './bearer-token.util';

interface KeycloakJwtPayload extends jwt.JwtPayload {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
}

interface Jwk {
  kid: string;
  kty: string;
  [key: string]: unknown;
}

const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Valida el JWT contra el JWKS del realm de Keycloak. El userId interno SIEMPRE se resuelve
 * del `sub` del token verificado — nunca de un userId que venga en el body/params (spec 4.1).
 *
 * JWK -> clave pública vía `node:crypto` (soportado nativamente desde Node 15.12), en vez de
 * `jwks-rsa`/`jwk-to-pem`: evita depender de `jose` (ESM-only, fricción bajo Jest) y de
 * `elliptic` (vulnerabilidad conocida sin fix, vía jwk-to-pem) sin agregar dependencias.
 */
@Injectable()
export class KeycloakAuthGuard implements CanActivate {
  private readonly issuer: string;
  private readonly jwksUri: string;
  private jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    // `issuer` es el valor esperado en el claim `iss` (lo que Keycloak estampa según su
    // KC_HOSTNAME fijo — el mismo desde host o desde dentro de docker compose).
    // `jwksUri` es la URL desde la que ESTE proceso puede efectivamente alcanzar Keycloak
    // para pedir las claves — dentro de docker compose es el hostname interno (`keycloak`),
    // no `localhost`. Por eso son dos variables separadas en vez de derivar una de la otra.
    this.issuer = this.config.getOrThrow<string>('KEYCLOAK_ISSUER_URL');
    this.jwksUri =
      this.config.get<string>('KEYCLOAK_JWKS_URI') ??
      `${this.issuer}/protocol/openid-connect/certs`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('missing_bearer_token');
    }

    const payload = await this.verify(token);
    const user = await this.usersService.findOrCreateFromToken({
      id: payload.sub,
      email: payload.email ?? `${payload.sub}@unknown.local`,
      displayName: payload.name ?? payload.preferred_username,
    });

    (request as Request & { user: unknown }).user = {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      authMethod: 'keycloak',
    };
    return true;
  }

  private async verify(token: string): Promise<KeycloakJwtPayload> {
    const decoded = jwt.decode(token, { complete: true });
    const kid = decoded?.header.kid;
    if (!kid) {
      throw new UnauthorizedException('invalid_token');
    }

    const publicKey = await this.getPublicKey(kid);

    try {
      return jwt.verify(token, publicKey, {
        issuer: this.issuer,
        algorithms: ['RS256'],
      }) as KeycloakJwtPayload;
    } catch {
      throw new UnauthorizedException('invalid_token');
    }
  }

  private async getPublicKey(
    kid: string,
    retriedAfterCacheMiss = false,
  ): Promise<KeyObject> {
    if (
      !this.jwksCache ||
      Date.now() - this.jwksCache.fetchedAt > JWKS_CACHE_TTL_MS
    ) {
      await this.refreshJwks();
    }

    const jwk = this.jwksCache?.keys.find((key) => key.kid === kid);
    if (!jwk) {
      // Puede ser rotación de claves recién ocurrida: invalidamos y reintentamos una vez.
      if (!retriedAfterCacheMiss) {
        this.jwksCache = null;
        return this.getPublicKey(kid, true);
      }
      throw new UnauthorizedException('signing_key_not_found');
    }

    return createPublicKey({
      key: jwk as unknown as Record<string, unknown>,
      format: 'jwk',
    });
  }

  private async refreshJwks(): Promise<void> {
    const response = await fetch(this.jwksUri);
    if (!response.ok) {
      throw new UnauthorizedException('jwks_fetch_failed');
    }
    const body = (await response.json()) as { keys: Jwk[] };
    this.jwksCache = { keys: body.keys, fetchedAt: Date.now() };
  }
}
