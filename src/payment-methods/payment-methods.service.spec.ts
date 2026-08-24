import { NotFoundException } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethodsRepository } from './payment-methods.repository';

function createMockRepository() {
  return {
    search: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findById: jest.fn(),
  };
}

const CASH_MODEL = {
  id: 'pm-1',
  userId: 'user-1',
  name: 'Efectivo',
  type: 'CASH' as const,
  billingCycleStart: null,
  billingCycleEnd: null,
  createdAt: new Date('2026-01-01'),
};
const CREDIT_MODEL = {
  id: 'pm-2',
  userId: 'user-1',
  name: 'Visa',
  type: 'CREDIT' as const,
  billingCycleStart: 1,
  billingCycleEnd: 30,
  createdAt: new Date('2026-01-01'),
};

describe('PaymentMethodsService', () => {
  let repository: ReturnType<typeof createMockRepository>;
  let service: PaymentMethodsService;

  beforeEach(() => {
    repository = createMockRepository();
    service = new PaymentMethodsService(
      repository as unknown as PaymentMethodsRepository,
    );
  });

  describe('search', () => {
    it('pagina y minifica los resultados', async () => {
      repository.search.mockResolvedValue([CASH_MODEL]);
      repository.count.mockResolvedValue(1);
      const result = await service.search('user-1', {});
      expect(result.data).toEqual([
        { id: 'pm-1', name: 'Efectivo', type: 'CASH' },
      ]);
    });
  });

  describe('create', () => {
    it('ignora billing_cycle_* si el tipo no es CREDIT', async () => {
      repository.create.mockResolvedValue(CASH_MODEL);
      await service.create('user-1', {
        name: 'Efectivo',
        type: 'CASH',
        billingCycleStart: 5,
        billingCycleEnd: 10,
      } as never);
      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Efectivo',
        type: 'CASH',
        billingCycleStart: null,
        billingCycleEnd: null,
      });
    });

    it('persiste billing_cycle_* si el tipo es CREDIT', async () => {
      repository.create.mockResolvedValue(CREDIT_MODEL);
      await service.create('user-1', {
        name: 'Visa',
        type: 'CREDIT',
        billingCycleStart: 1,
        billingCycleEnd: 30,
      } as never);
      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Visa',
        type: 'CREDIT',
        billingCycleStart: 1,
        billingCycleEnd: 30,
      });
    });
  });

  describe('patch', () => {
    it('lanza 404 si no existe o no es del usuario', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.patch('user-1', 'pm-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza 404 si pertenece a otro usuario', async () => {
      repository.findById.mockResolvedValue({
        ...CASH_MODEL,
        userId: 'other-user',
      });
      await expect(service.patch('user-1', 'pm-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('null-ea billing_cycle_* al cambiar de CREDIT a CASH', async () => {
      repository.findById.mockResolvedValue(CREDIT_MODEL);
      repository.update.mockResolvedValue({
        ...CREDIT_MODEL,
        type: 'CASH',
        billingCycleStart: null,
        billingCycleEnd: null,
      });
      await service.patch('user-1', 'pm-2', { type: 'CASH' } as never);
      expect(repository.update).toHaveBeenCalledWith('pm-2', {
        name: undefined,
        type: 'CASH',
        billingCycleStart: null,
        billingCycleEnd: null,
      });
    });

    it('mantiene billing_cycle_* existentes si no vienen en el patch y sigue siendo CREDIT', async () => {
      repository.findById.mockResolvedValue(CREDIT_MODEL);
      repository.update.mockResolvedValue(CREDIT_MODEL);
      await service.patch('user-1', 'pm-2', { name: 'Visa Platinum' });
      expect(repository.update).toHaveBeenCalledWith('pm-2', {
        name: 'Visa Platinum',
        type: undefined,
        billingCycleStart: 1,
        billingCycleEnd: 30,
      });
    });
  });

  describe('delete', () => {
    it('lanza 404 si no es del usuario', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.delete('user-1', 'pm-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('borra si es del usuario', async () => {
      repository.findById.mockResolvedValue(CASH_MODEL);
      await service.delete('user-1', 'pm-1');
      expect(repository.delete).toHaveBeenCalledWith('pm-1');
    });
  });

  describe('assertOwnedByUser', () => {
    it('lanza 404 si no es del usuario (usado por ExpensesService)', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.assertOwnedByUser('pm-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('no lanza nada si es del usuario', async () => {
      repository.findById.mockResolvedValue(CASH_MODEL);
      await expect(
        service.assertOwnedByUser('pm-1', 'user-1'),
      ).resolves.toBeUndefined();
    });
  });
});
