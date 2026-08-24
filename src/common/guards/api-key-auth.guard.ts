import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiKeysService } from '../../api-keys/api-keys.service';
import { UsersService } from '../../users/users.service';
import { extractBearerToken } from './bearer-token.util';

/**
 * Valida una API Key propia (hasheada con SHA-256 en DB, spec 4.2) y resuelve al mismo
 * userId interno que KeycloakAuthGuard. Cada key es personal e intransferible.
 *
 * Nunca toca Prisma directo — pasa por ApiKeysService.validateAndTouch (dueño de la tabla
 * api_keys) y UsersService.findById (dueño de la tabla users), igual que cualquier otro
 * consumidor cross-módulo.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('missing_api_key');
    }

    const result = await this.apiKeysService.validateAndTouch(token);
    if (!result) {
      throw new UnauthorizedException('invalid_api_key');
    }
    const user = await this.usersService.findById(result.userId);

    (request as Request & { user: unknown }).user = {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      authMethod: 'api-key',
    };
    return true;
  }
}
