import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { ApiKeysService } from '../../api-keys/api-keys.service';
import { UsersService } from '../../users/users.service';

function contextWithAuth(authorization?: string): {
  context: ExecutionContext;
  request: { headers: Record<string, string | undefined>; user?: unknown };
} {
  const request: {
    headers: Record<string, string | undefined>;
    user?: unknown;
  } = { headers: { authorization } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('ApiKeyAuthGuard', () => {
  let apiKeysService: { validateAndTouch: jest.Mock };
  let usersService: { findById: jest.Mock };
  let guard: ApiKeyAuthGuard;

  beforeEach(() => {
    apiKeysService = { validateAndTouch: jest.fn() };
    usersService = { findById: jest.fn() };
    guard = new ApiKeyAuthGuard(
      apiKeysService as unknown as ApiKeysService,
      usersService as unknown as UsersService,
    );
  });

  it('lanza 401 si no hay token', async () => {
    const { context } = contextWithAuth(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza 401 si la API Key es inválida o revocada', async () => {
    apiKeysService.validateAndTouch.mockResolvedValue(null);
    const { context } = contextWithAuth('Bearer pfk_invalid');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('resuelve request.user desde el userId de la API Key', async () => {
    apiKeysService.validateAndTouch.mockResolvedValue({ userId: 'user-1' });
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      displayName: 'Test User',
    });

    const { context, request } = contextWithAuth('Bearer pfk_valid');
    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(apiKeysService.validateAndTouch).toHaveBeenCalledWith('pfk_valid');
    expect(usersService.findById).toHaveBeenCalledWith('user-1');
    expect(request.user).toEqual({
      userId: 'user-1',
      email: 'test@example.com',
      displayName: 'Test User',
      authMethod: 'api-key',
    });
  });
});
