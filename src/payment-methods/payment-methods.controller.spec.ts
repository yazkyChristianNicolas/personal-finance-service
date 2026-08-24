import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

const USER: AuthenticatedUser = {
  userId: 'user-1',
  email: 'test@example.com',
  displayName: null,
  authMethod: 'keycloak',
};

describe('PaymentMethodsController', () => {
  let service: {
    search: jest.Mock;
    create: jest.Mock;
    patch: jest.Mock;
    delete: jest.Mock;
  };
  let controller: PaymentMethodsController;

  beforeEach(() => {
    service = {
      search: jest.fn(),
      create: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };
    controller = new PaymentMethodsController(
      service as unknown as PaymentMethodsService,
    );
  });

  it('search delega en el service', async () => {
    await controller.search(USER, {});
    expect(service.search).toHaveBeenCalledWith('user-1', {});
  });

  it('create delega en el service', async () => {
    await controller.create(USER, { name: 'Efectivo', type: 'CASH' } as never);
    expect(service.create).toHaveBeenCalledWith('user-1', {
      name: 'Efectivo',
      type: 'CASH',
    });
  });

  it('patch delega en el service con el id del path', async () => {
    await controller.patch(USER, 'pm-1', { name: 'Nuevo' });
    expect(service.patch).toHaveBeenCalledWith('user-1', 'pm-1', {
      name: 'Nuevo',
    });
  });

  it('delete delega en el service y no devuelve contenido', async () => {
    await controller.delete(USER, 'pm-1');
    expect(service.delete).toHaveBeenCalledWith('user-1', 'pm-1');
  });
});
