import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

const USER: AuthenticatedUser = {
  userId: 'user-1',
  email: 'test@example.com',
  displayName: null,
  authMethod: 'keycloak',
};

describe('ApiKeysController', () => {
  let service: { create: jest.Mock; search: jest.Mock; delete: jest.Mock };
  let controller: ApiKeysController;

  beforeEach(() => {
    service = { create: jest.fn(), search: jest.fn(), delete: jest.fn() };
    controller = new ApiKeysController(service as unknown as ApiKeysService);
  });

  it('create delega en el service', async () => {
    await controller.create(USER, { label: 'mcp-agent' });
    expect(service.create).toHaveBeenCalledWith('user-1', {
      label: 'mcp-agent',
    });
  });

  it('search delega en el service', async () => {
    await controller.search(USER, {});
    expect(service.search).toHaveBeenCalledWith('user-1', {});
  });

  it('delete delega en el service y no devuelve contenido', async () => {
    await controller.delete(USER, 'key-1');
    expect(service.delete).toHaveBeenCalledWith('user-1', 'key-1');
  });
});
