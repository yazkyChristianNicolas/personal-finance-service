import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { KeycloakAuthGuard } from './keycloak-auth.guard';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { extractBearerToken, looksLikeJwt } from './bearer-token.util';

/**
 * Guard compuesto para endpoints de negocio (groups, payment-methods, expenses): acepta
 * tanto un JWT de Keycloak (usuario logueado) como una API Key propia (agente MCP actuando
 * en nombre del usuario) — spec 4.1/4.2. Los endpoints de gestión de API Keys en sí usan
 * KeycloakAuthGuard directamente, nunca este guard compuesto.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly keycloakGuard: KeycloakAuthGuard,
    private readonly apiKeyGuard: ApiKeyAuthGuard,
  ) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('missing_bearer_token');
    }

    return looksLikeJwt(token)
      ? this.keycloakGuard.canActivate(context)
      : this.apiKeyGuard.canActivate(context);
  }
}
