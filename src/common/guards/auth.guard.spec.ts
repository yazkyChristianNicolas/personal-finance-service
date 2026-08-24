import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { KeycloakAuthGuard } from './keycloak-auth.guard';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

function contextWithAuth(authorization?: string): ExecutionContext {
  const request = { headers: { authorization } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let keycloakGuard: { canActivate: jest.Mock };
  let apiKeyGuard: { canActivate: jest.Mock };
  let guard: AuthGuard;

  beforeEach(() => {
    keycloakGuard = { canActivate: jest.fn().mockResolvedValue(true) };
    apiKeyGuard = { canActivate: jest.fn().mockResolvedValue(true) };
    guard = new AuthGuard(
      keycloakGuard as unknown as KeycloakAuthGuard,
      apiKeyGuard as unknown as ApiKeyAuthGuard,
    );
  });

  it('lanza 401 si no hay token, sin delegar a ningún guard', () => {
    // canActivate tira sync en este caso (no hay await antes del throw), no devuelve una Promise rechazada.
    expect(() => guard.canActivate(contextWithAuth(undefined))).toThrow(
      UnauthorizedException,
    );
    expect(keycloakGuard.canActivate).not.toHaveBeenCalled();
    expect(apiKeyGuard.canActivate).not.toHaveBeenCalled();
  });

  it('delega a KeycloakAuthGuard si el token tiene forma de JWT (3 segmentos)', async () => {
    const context = contextWithAuth('Bearer header.payload.signature');
    await guard.canActivate(context);
    expect(keycloakGuard.canActivate).toHaveBeenCalledWith(context);
    expect(apiKeyGuard.canActivate).not.toHaveBeenCalled();
  });

  it('delega a ApiKeyAuthGuard si el token no tiene forma de JWT', async () => {
    const context = contextWithAuth('Bearer pfk_abc123');
    await guard.canActivate(context);
    expect(apiKeyGuard.canActivate).toHaveBeenCalledWith(context);
    expect(keycloakGuard.canActivate).not.toHaveBeenCalled();
  });
});
