import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { KeycloakAuthGuard } from './keycloak-auth.guard';
import { UsersService } from '../../users/users.service';

jest.mock('jsonwebtoken');
jest.mock('node:crypto', () => ({
  createPublicKey: jest.fn().mockReturnValue({}),
}));

const mockedJwt = jwt as jest.Mocked<typeof jwt>;
const JWK = { kid: 'kid-1', kty: 'RSA' };

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

describe('KeycloakAuthGuard', () => {
  let config: { getOrThrow: jest.Mock; get: jest.Mock };
  let usersService: { findOrCreateFromToken: jest.Mock };
  let guard: KeycloakAuthGuard;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    config = {
      getOrThrow: jest
        .fn()
        .mockReturnValue('http://localhost:8080/realms/personal-finance'),
      get: jest.fn().mockReturnValue(undefined),
    };
    usersService = { findOrCreateFromToken: jest.fn() };
    guard = new KeycloakAuthGuard(
      config as unknown as ConfigService,
      usersService as unknown as UsersService,
    );
    fetchSpy = jest.spyOn(global, 'fetch');
    jest.clearAllMocks();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('usa KEYCLOAK_JWKS_URI si está definida, si no la deriva del issuer', () => {
    config.get.mockReturnValue(
      'http://keycloak:8080/realms/x/protocol/openid-connect/certs',
    );
    const custom = new KeycloakAuthGuard(
      config as unknown as ConfigService,
      usersService as unknown as UsersService,
    );
    expect(custom).toBeDefined();
  });

  it('lanza 401 si no hay token', async () => {
    const { context } = contextWithAuth(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza 401 si el token no tiene kid en el header', async () => {
    mockedJwt.decode.mockReturnValue({
      header: {},
      payload: {},
      signature: '',
    });
    const { context } = contextWithAuth('Bearer x.y.z');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza 401 si falla el fetch del JWKS', async () => {
    mockedJwt.decode.mockReturnValue({
      header: { kid: 'kid-1' },
      payload: {},
      signature: '',
    });
    fetchSpy.mockResolvedValue({ ok: false } as Response);
    const { context } = contextWithAuth('Bearer x.y.z');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza 401 si el JWKS no trae la clave pedida (ni tras reintentar)', async () => {
    mockedJwt.decode.mockReturnValue({
      header: { kid: 'unknown-kid' },
      payload: {},
      signature: '',
    });
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ keys: [] }),
    } as Response);
    const { context } = contextWithAuth('Bearer x.y.z');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2); // 1 intento + 1 reintento por invalidación de cache
  });

  it('lanza 401 si jwt.verify rechaza el token', async () => {
    mockedJwt.decode.mockReturnValue({
      header: { kid: 'kid-1' },
      payload: {},
      signature: '',
    });
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ keys: [JWK] }),
    } as Response);
    mockedJwt.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const { context } = contextWithAuth('Bearer x.y.z');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('resuelve request.user desde el sub verificado y sincroniza el usuario', async () => {
    mockedJwt.decode.mockReturnValue({
      header: { kid: 'kid-1' },
      payload: {},
      signature: '',
    });
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ keys: [JWK] }),
    } as Response);
    mockedJwt.verify.mockReturnValue({
      sub: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    } as never);
    usersService.findOrCreateFromToken.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      displayName: 'Test User',
    });

    const { context, request } = contextWithAuth('Bearer x.y.z');
    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(usersService.findOrCreateFromToken).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'test@example.com',
      displayName: 'Test User',
    });
    expect(request.user).toEqual({
      userId: 'user-1',
      email: 'test@example.com',
      displayName: 'Test User',
      authMethod: 'keycloak',
    });
  });

  it('usa un email/displayName por default si el payload no los trae', async () => {
    mockedJwt.decode.mockReturnValue({
      header: { kid: 'kid-1' },
      payload: {},
      signature: '',
    });
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ keys: [JWK] }),
    } as Response);
    mockedJwt.verify.mockReturnValue({ sub: 'user-2' } as never);
    usersService.findOrCreateFromToken.mockResolvedValue({
      id: 'user-2',
      email: 'user-2@unknown.local',
      displayName: undefined,
    });

    const { context } = contextWithAuth('Bearer x.y.z');
    await guard.canActivate(context);

    expect(usersService.findOrCreateFromToken).toHaveBeenCalledWith({
      id: 'user-2',
      email: 'user-2@unknown.local',
      displayName: undefined,
    });
  });

  it('cachea el JWKS entre llamadas (un solo fetch para 2 requests)', async () => {
    mockedJwt.decode.mockReturnValue({
      header: { kid: 'kid-1' },
      payload: {},
      signature: '',
    });
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ keys: [JWK] }),
    } as Response);
    mockedJwt.verify.mockReturnValue({
      sub: 'user-1',
      email: 'test@example.com',
    } as never);
    usersService.findOrCreateFromToken.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      displayName: null,
    });

    await guard.canActivate(contextWithAuth('Bearer x.y.z').context);
    await guard.canActivate(contextWithAuth('Bearer x.y.z').context);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
