import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

const USER: AuthenticatedUser = {
  userId: 'user-1',
  email: 'test@example.com',
  displayName: null,
  authMethod: 'keycloak',
};

describe('ExpensesController', () => {
  let service: {
    search: jest.Mock;
    create: jest.Mock;
    findById: jest.Mock;
    patch: jest.Mock;
    delete: jest.Mock;
  };
  let controller: ExpensesController;

  beforeEach(() => {
    service = {
      search: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };
    controller = new ExpensesController(service as unknown as ExpensesService);
  });

  it('search delega en el service', async () => {
    await controller.search(USER, {});
    expect(service.search).toHaveBeenCalledWith('user-1', {});
  });

  it('create delega en el service', async () => {
    const dto = {
      date: '2026-01-01',
      amount: 100,
      currency: 'ARS',
      description: 'x',
      category: 'y',
      groupId: 'g1',
      paymentMethodId: 'pm1',
    };
    await controller.create(USER, dto);
    expect(service.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('findById delega en el service con el id del path', async () => {
    await controller.findById(USER, 'expense-1');
    expect(service.findById).toHaveBeenCalledWith('user-1', 'expense-1');
  });

  it('patch delega en el service', async () => {
    await controller.patch(USER, 'expense-1', { description: 'nuevo' });
    expect(service.patch).toHaveBeenCalledWith('user-1', 'expense-1', {
      description: 'nuevo',
    });
  });

  it('delete delega en el service y no devuelve contenido', async () => {
    await controller.delete(USER, 'expense-1');
    expect(service.delete).toHaveBeenCalledWith('user-1', 'expense-1');
  });
});
