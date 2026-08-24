import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { extractBearerToken } from './bearer-token.util';

/**
 * Valida una API Key propia (hasheada con SHA-256 en DB, spec 4.2) y resuelve al mismo
 * userId interno que KeycloakAuthGuard. Cada key es personal e intransferible.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('missing_api_key');
    }

    const hash = createHash('sha256').update(token).digest('hex');
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { hash },
      include: { user: true },
    });

    if (!apiKey || apiKey.revokedAt) {
      throw new UnauthorizedException('invalid_api_key');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    (request as Request & { user: unknown }).user = {
      userId: apiKey.user.id,
      email: apiKey.user.email,
      displayName: apiKey.user.displayName,
      authMethod: 'api-key',
    };
    return true;
  }
}
