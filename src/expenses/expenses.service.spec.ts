import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesRepository, CreateExpenseData } from './expenses.repository';
import { GroupsService } from '../groups/groups.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { CreateExpenseDto } from './dto/request/create-expense.dto';
import { ExpenseModel } from './model/expense.model';

const USER_ID = 'user-1';
const GROUP_ID = 'group-1';
const PAYMENT_METHOD_ID = 'pm-1';

function baseDto(overrides: Partial<CreateExpenseDto> = {}): CreateExpenseDto {
  return {
    date: '2026-01-01',
    amount: 1000,
    currency: 'ARS',
    description: 'test',
    category: 'groceries',
    groupId: GROUP_ID,
    paymentMethodId: PAYMENT_METHOD_ID,
    ...overrides,
  };
}

/** Simula lo que haría el Repository real: arma un ExpenseModel a partir de la data recibida. */
function fakeCreate(data: CreateExpenseData): Promise<ExpenseModel> {
  return Promise.resolve({
    id: 'expense-1',
    date: data.date,
    amount: data.amount,
    currency: data.currency,
    description: data.description,
    category: data.category,
    groupId: data.groupId,
    paymentMethodId: data.paymentMethodId,
    createdByUserId: data.createdByUserId,
    isRecurring: false,
    recurringTemplateId: null,
    installmentPlanId: null,
    createdAt: new Date('2026-01-01'),
    splits: data.splits.map((s, index) => ({
      id: `split-${index}`,
      expenseId: 'expense-1',
      userId: s.userId,
      amount: s.amount,
      percentage: s.percentage ?? null,
    })),
  });
}

describe('ExpensesService', () => {
  let service: ExpensesService;
  let expensesRepository: {
    create: jest.Mock<Promise<ExpenseModel>, [CreateExpenseData]>;
  };
  let groupsService: {
    assertMembership: jest.Mock;
    findById: jest.Mock;
    getMemberUserIds: jest.Mock;
    getMemberGroupIds: jest.Mock;
  };
  let paymentMethodsService: { assertOwnedByUser: jest.Mock };

  beforeEach(async () => {
    expensesRepository = {
      create: jest
        .fn<Promise<ExpenseModel>, [CreateExpenseData]>()
        .mockImplementation(fakeCreate),
    };
    groupsService = {
      assertMembership: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      getMemberUserIds: jest.fn(),
      getMemberGroupIds: jest.fn(),
    };
    paymentMethodsService = {
      assertOwnedByUser: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: ExpensesRepository, useValue: expensesRepository },
        { provide: GroupsService, useValue: groupsService },
        { provide: PaymentMethodsService, useValue: paymentMethodsService },
      ],
    }).compile();

    service = module.get(ExpensesService);
  });

  it('no crea splits para el grupo Personal', async () => {
    groupsService.findById.mockResolvedValue({ id: GROUP_ID, isDefault: true });

    const result = await service.create(USER_ID, baseDto());

    expect(expensesRepository.create.mock.calls[0][0].splits).toEqual([]);
    expect(result.splits).toEqual([]);
  });

  it('exige splitStrategy en un grupo no-Personal', async () => {
    groupsService.findById.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
    });

    await expect(service.create(USER_ID, baseDto())).rejects.toThrow(
      BadRequestException,
    );
  });

  it('EQUAL reparte el resto de centavos entre los primeros miembros para que la suma cierre exacto', async () => {
    groupsService.findById.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
    });
    groupsService.getMemberUserIds.mockResolvedValue(['a', 'b', 'c']);

    const result = await service.create(
      USER_ID,
      baseDto({
        amount: 1000,
        splitStrategy: 'EQUAL' as CreateExpenseDto['splitStrategy'],
      }),
    );

    expect(result.splits.map((s) => s.amount)).toEqual([334, 333, 333]);
    expect(result.splits.reduce((sum, s) => sum + s.amount, 0)).toBe(1000);
  });

  it('PERCENTAGE valida que los porcentajes sumen 100 y reconcilia el redondeo', async () => {
    groupsService.findById.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
    });
    groupsService.getMemberUserIds.mockResolvedValue(['a', 'b']);

    const result = await service.create(
      USER_ID,
      baseDto({
        amount: 1000,
        splitStrategy: 'PERCENTAGE' as CreateExpenseDto['splitStrategy'],
        splitMembers: [
          { userId: 'a', percentage: 33.33 },
          { userId: 'b', percentage: 66.67 },
        ],
      }),
    );

    expect(result.splits.reduce((sum, s) => sum + s.amount, 0)).toBe(1000);
  });

  it('PERCENTAGE rechaza porcentajes que no suman 100', async () => {
    groupsService.findById.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
    });
    groupsService.getMemberUserIds.mockResolvedValue(['a', 'b']);

    await expect(
      service.create(
        USER_ID,
        baseDto({
          splitStrategy: 'PERCENTAGE' as CreateExpenseDto['splitStrategy'],
          splitMembers: [
            { userId: 'a', percentage: 40 },
            { userId: 'b', percentage: 40 },
          ],
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('ROMANA exige que los montos provistos sumen exactamente el total', async () => {
    groupsService.findById.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
    });
    groupsService.getMemberUserIds.mockResolvedValue(['a', 'b']);

    await expect(
      service.create(
        USER_ID,
        baseDto({
          amount: 1000,
          splitStrategy: 'ROMANA' as CreateExpenseDto['splitStrategy'],
          splitMembers: [
            { userId: 'a', amount: 400 },
            { userId: 'b', amount: 400 },
          ],
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('ROMANA rechaza un userId que no es miembro del grupo', async () => {
    groupsService.findById.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
    });
    groupsService.getMemberUserIds.mockResolvedValue(['a']);

    await expect(
      service.create(
        USER_ID,
        baseDto({
          amount: 1000,
          splitStrategy: 'ROMANA' as CreateExpenseDto['splitStrategy'],
          splitMembers: [{ userId: 'not-a-member', amount: 1000 }],
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
