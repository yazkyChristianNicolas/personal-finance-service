import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  displayName?: string | null;
  authMethod: 'keycloak' | 'api-key';
}

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * Devuelve el usuario resuelto por KeycloakAuthGuard/ApiKeyAuthGuard/AuthGuard.
 * Nunca usar un userId que venga del body/params del request — siempre este decorator.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new Error(
        'CurrentUser used outside of an authenticated route (no guard resolved request.user)',
      );
    }
    return request.user;
  },
);
