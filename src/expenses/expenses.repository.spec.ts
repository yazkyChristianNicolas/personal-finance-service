import { ExpensesRepository } from './expenses.repository';
import { PrismaService } from '../prisma/prisma.service';

const SPLIT_ROW = {
  id: 'split-1',
  expenseId: 'expense-1',
  userId: 'user-1',
  amount: 500,
  percentage: null,
  createdAt: new Date('2026-01-01'),
};
const EXPENSE_ROW = {
  id: 'expense-1',
  date: new Date('2026-01-01'),
  amount: 1000,
  currency: 'ARS',
  description: 'Supermercado',
  category: 'groceries',
  groupId: 'group-1',
  paymentMethodId: 'pm-1',
  createdByUserId: 'user-1',
  isRecurring: false,
  recurringTemplateId: null,
  installmentPlanId: null,
  installmentNumber: null,
  createdAt: new Date('2026-01-01'),
  splits: [SPLIT_ROW],
  installmentPlan: null,
};

const INSTALLMENT_PLAN_ROW = {
  id: 'plan-1',
  paymentMethodId: 'pm-1',
  totalAmount: 1000,
  installmentsCount: 3,
  currentInstallment: 1,
  completed: false,
  createdAt: new Date('2026-01-01'),
};

function createMockPrisma() {
  return {
    expense: {
      create: jest.fn<
        Promise<typeof EXPENSE_ROW>,
        [{ data: Record<string, unknown> }]
      >(),
      findMany: jest.fn<
        Promise<(typeof EXPENSE_ROW)[]>,
        [{ where: Record<string, unknown> }]
      >(),
      count: jest.fn<Promise<number>, [{ where: Record<string, unknown> }]>(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    installmentPlan: {
      create: jest.fn<
        Promise<typeof INSTALLMENT_PLAN_ROW>,
        [{ data: Record<string, unknown> }]
      >(),
      findMany: jest.fn<
        Promise<(typeof INSTALLMENT_PLAN_ROW)[]>,
        [{ where: Record<string, unknown> }]
      >(),
      update: jest.fn<
        Promise<typeof INSTALLMENT_PLAN_ROW>,
        [{ where: { id: string }; data: Record<string, unknown> }]
      >(),
    },
  };
}

describe('ExpensesRepository', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let repository: ExpensesRepository;

  beforeEach(() => {
    prisma = createMockPrisma();
    repository = new ExpensesRepository(prisma as unknown as PrismaService);
  });

  it('create arma el nested create de splits solo si hay splits', async () => {
    prisma.expense.create.mockResolvedValue(EXPENSE_ROW);
    await repository.create({
      date: EXPENSE_ROW.date,
      amount: 1000,
      currency: 'ARS',
      description: 'Supermercado',
      category: 'groceries',
      groupId: 'group-1',
      paymentMethodId: 'pm-1',
      createdByUserId: 'user-1',
      splits: [{ userId: 'user-1', amount: 1000 }],
    });
    const callArgs = prisma.expense.create.mock.calls[0][0];
    expect(callArgs.data.splits).toEqual({
      create: [{ userId: 'user-1', amount: 1000 }],
    });
  });

  it('create omite el campo splits si no hay ninguno', async () => {
    prisma.expense.create.mockResolvedValue({ ...EXPENSE_ROW, splits: [] });
    await repository.create({
      date: EXPENSE_ROW.date,
      amount: 1000,
      currency: 'ARS',
      description: 'Supermercado',
      category: 'groceries',
      groupId: 'group-1',
      paymentMethodId: 'pm-1',
      createdByUserId: 'user-1',
      splits: [],
    });
    const callArgs = prisma.expense.create.mock.calls[0][0];
    expect(callArgs.data.splits).toBeUndefined();
  });

  it('search arma el where con groupId IN y los filtros opcionales, y mapea el resultado', async () => {
    prisma.expense.findMany.mockResolvedValue([EXPENSE_ROW]);
    const result = await repository.search(
      {
        groupIds: ['group-1'],
        category: 'groceries',
        currency: 'ARS',
        dateFrom: new Date('2026-01-01'),
        dateTo: new Date('2026-01-31'),
      },
      0,
      20,
    );
    const callArgs = prisma.expense.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({
      groupId: { in: ['group-1'] },
      category: 'groceries',
      currency: 'ARS',
      date: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
    });
    expect(result[0].id).toBe('expense-1');
  });

  it('search no agrega filtros opcionales ausentes al where', async () => {
    prisma.expense.findMany.mockResolvedValue([]);
    await repository.search({ groupIds: ['group-1'] }, 0, 20);
    const callArgs = prisma.expense.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({ groupId: { in: ['group-1'] } });
  });

  it('count usa el mismo where builder que search', async () => {
    prisma.expense.count.mockResolvedValue(7);
    await expect(
      repository.count({ groupIds: ['group-1'], paymentMethodId: 'pm-1' }),
    ).resolves.toBe(7);
    const callArgs = prisma.expense.count.mock.calls[0][0];
    expect(callArgs.where).toEqual({
      groupId: { in: ['group-1'] },
      paymentMethodId: 'pm-1',
    });
  });

  it('findById devuelve null si no existe', async () => {
    prisma.expense.findUnique.mockResolvedValue(null);
    await expect(repository.findById('expense-1')).resolves.toBeNull();
  });

  it('findById mapea la fila con splits si existe', async () => {
    prisma.expense.findUnique.mockResolvedValue(EXPENSE_ROW);
    const result = await repository.findById('expense-1');
    expect(result?.splits).toHaveLength(1);
  });

  it('update persiste y mapea el resultado', async () => {
    prisma.expense.update.mockResolvedValue({
      ...EXPENSE_ROW,
      description: 'Actualizado',
    });
    const result = await repository.update('expense-1', {
      description: 'Actualizado',
    });
    expect(prisma.expense.update).toHaveBeenCalledWith({
      where: { id: 'expense-1' },
      data: { description: 'Actualizado' },
      include: { splits: true, installmentPlan: true },
    });
    expect(result.description).toBe('Actualizado');
  });

  it('delete delega en prisma.expense.delete', async () => {
    prisma.expense.delete.mockResolvedValue(EXPENSE_ROW);
    await repository.delete('expense-1');
    expect(prisma.expense.delete).toHaveBeenCalledWith({
      where: { id: 'expense-1' },
    });
  });

  it('createInstallmentPlan inserta con currentInstallment=1 y completed=false', async () => {
    prisma.installmentPlan.create.mockResolvedValue(INSTALLMENT_PLAN_ROW);
    const result = await repository.createInstallmentPlan({
      paymentMethodId: 'pm-1',
      totalAmount: 1000,
      installmentsCount: 3,
    });
    expect(prisma.installmentPlan.create).toHaveBeenCalledWith({
      data: {
        paymentMethodId: 'pm-1',
        totalAmount: 1000,
        installmentsCount: 3,
        currentInstallment: 1,
        completed: false,
      },
    });
    expect(result.id).toBe('plan-1');
  });

  it('findActiveInstallmentPlans filtra por paymentMethodId y completed=false', async () => {
    prisma.installmentPlan.findMany.mockResolvedValue([INSTALLMENT_PLAN_ROW]);
    const result = await repository.findActiveInstallmentPlans('pm-1');
    expect(prisma.installmentPlan.findMany).toHaveBeenCalledWith({
      where: { paymentMethodId: 'pm-1', completed: false },
    });
    expect(result).toHaveLength(1);
  });

  it('advanceInstallmentPlan actualiza currentInstallment y completed', async () => {
    prisma.installmentPlan.update.mockResolvedValue(INSTALLMENT_PLAN_ROW);
    await repository.advanceInstallmentPlan('plan-1', 3, true);
    expect(prisma.installmentPlan.update).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { currentInstallment: 3, completed: true },
    });
  });

  it('findLatestByInstallmentPlanId ordena por installmentNumber desc', async () => {
    prisma.expense.findFirst.mockResolvedValue(EXPENSE_ROW);
    const result = await repository.findLatestByInstallmentPlanId('plan-1');
    expect(prisma.expense.findFirst).toHaveBeenCalledWith({
      where: { installmentPlanId: 'plan-1' },
      orderBy: { installmentNumber: 'desc' },
      include: { splits: true, installmentPlan: true },
    });
    expect(result?.id).toBe('expense-1');
  });

  it('findLatestByInstallmentPlanId devuelve null si no hay ninguna', async () => {
    prisma.expense.findFirst.mockResolvedValue(null);
    await expect(
      repository.findLatestByInstallmentPlanId('plan-1'),
    ).resolves.toBeNull();
  });
});
