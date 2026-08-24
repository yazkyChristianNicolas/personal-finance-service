import { ExpensesMapper, ExpenseRowWithSplits } from './expenses.mapper';
import { ExpenseSplit } from '../../generated/prisma/client';

const SPLIT_ROW: ExpenseSplit = {
  id: 'split-1',
  expenseId: 'expense-1',
  userId: 'user-1',
  amount: 500,
  percentage: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const EXPENSE_ROW: ExpenseRowWithSplits = {
  id: 'expense-1',
  date: new Date('2026-01-01T00:00:00.000Z'),
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
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  splits: [SPLIT_ROW],
};

describe('ExpensesMapper', () => {
  it('toSplitModel mapea la fila de split', () => {
    expect(ExpensesMapper.toSplitModel(SPLIT_ROW)).toEqual({
      id: 'split-1',
      expenseId: 'expense-1',
      userId: 'user-1',
      amount: 500,
      percentage: null,
    });
  });

  it('toModel mapea la fila con sus splits anidados', () => {
    const model = ExpensesMapper.toModel(EXPENSE_ROW);
    expect(model.id).toBe('expense-1');
    expect(model.groupId).toBe('group-1');
    expect(model.splits).toEqual([
      {
        id: 'split-1',
        expenseId: 'expense-1',
        userId: 'user-1',
        amount: 500,
        percentage: null,
      },
    ]);
  });

  it('toResponseDto devuelve el objeto completo con splits mapeados', () => {
    const model = ExpensesMapper.toModel(EXPENSE_ROW);
    const dto = ExpensesMapper.toResponseDto(model);
    expect(dto.id).toBe('expense-1');
    expect(dto.splits).toEqual(model.splits);
  });

  it('toSearchResultDto minifica (sin splits/payment_method_id/created_at)', () => {
    const model = ExpensesMapper.toModel(EXPENSE_ROW);
    expect(ExpensesMapper.toSearchResultDto(model)).toEqual({
      id: 'expense-1',
      date: EXPENSE_ROW.date,
      amount: 1000,
      currency: 'ARS',
      description: 'Supermercado',
      category: 'groceries',
      groupId: 'group-1',
    });
  });
});
