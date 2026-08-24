import { PaymentMethodsRepository } from './payment-methods.repository';
import { PrismaService } from '../prisma/prisma.service';

const ROW = {
  id: 'pm-1',
  userId: 'user-1',
  name: 'Tarjeta Visa',
  type: 'CREDIT',
  billingCycleStart: 1,
  billingCycleEnd: 30,
  createdAt: new Date('2026-01-01'),
};

function createMockPrisma() {
  return {
    paymentMethod: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

describe('PaymentMethodsRepository', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let repository: PaymentMethodsRepository;

  beforeEach(() => {
    prisma = createMockPrisma();
    repository = new PaymentMethodsRepository(
      prisma as unknown as PrismaService,
    );
  });

  it('search mapea las filas encontradas', async () => {
    prisma.paymentMethod.findMany.mockResolvedValue([ROW]);
    const result = await repository.search({ userId: 'user-1' }, 0, 20);
    expect(prisma.paymentMethod.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
    });
    expect(result).toEqual([
      {
        id: 'pm-1',
        userId: 'user-1',
        name: 'Tarjeta Visa',
        type: 'CREDIT',
        billingCycleStart: 1,
        billingCycleEnd: 30,
        createdAt: ROW.createdAt,
      },
    ]);
  });

  it('count delega en prisma.paymentMethod.count', async () => {
    prisma.paymentMethod.count.mockResolvedValue(5);
    await expect(repository.count({ userId: 'user-1' })).resolves.toBe(5);
  });

  it('create persiste y mapea el resultado', async () => {
    prisma.paymentMethod.create.mockResolvedValue(ROW);
    const data = {
      userId: 'user-1',
      name: 'Tarjeta Visa',
      type: 'CREDIT' as const,
      billingCycleStart: 1,
      billingCycleEnd: 30,
    };
    const result = await repository.create(data);
    expect(prisma.paymentMethod.create).toHaveBeenCalledWith({ data });
    expect(result.id).toBe('pm-1');
  });

  it('update persiste y mapea el resultado', async () => {
    prisma.paymentMethod.update.mockResolvedValue({
      ...ROW,
      name: 'Nuevo nombre',
    });
    const data = {
      name: 'Nuevo nombre',
      billingCycleStart: 1,
      billingCycleEnd: 30,
    };
    const result = await repository.update('pm-1', data);
    expect(prisma.paymentMethod.update).toHaveBeenCalledWith({
      where: { id: 'pm-1' },
      data,
    });
    expect(result.name).toBe('Nuevo nombre');
  });

  it('delete delega en prisma.paymentMethod.delete', async () => {
    prisma.paymentMethod.delete.mockResolvedValue(ROW);
    await repository.delete('pm-1');
    expect(prisma.paymentMethod.delete).toHaveBeenCalledWith({
      where: { id: 'pm-1' },
    });
  });

  it('findById devuelve null si no existe', async () => {
    prisma.paymentMethod.findUnique.mockResolvedValue(null);
    await expect(repository.findById('pm-1')).resolves.toBeNull();
  });

  it('findById mapea la fila si existe', async () => {
    prisma.paymentMethod.findUnique.mockResolvedValue(ROW);
    await expect(repository.findById('pm-1')).resolves.toMatchObject({
      id: 'pm-1',
    });
  });
});
