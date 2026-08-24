import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

const USER_ID = 'user-1';
const GROUP_ID = 'group-1';
const PAYMENT_METHOD_ID = 'pm-1';

interface CreateSplit {
  userId: string;
  amount: number;
}

interface ExpenseCreateArgs {
  data: { splits?: { create: CreateSplit[] } };
}

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

describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: {
    expense: { create: jest.Mock<Promise<unknown>, [ExpenseCreateArgs]> };
    group: { findUniqueOrThrow: jest.Mock };
    paymentMethod: { findUnique: jest.Mock };
    groupMember: { findMany: jest.Mock };
  };
  let groupsService: { assertMembership: jest.Mock };

  beforeEach(async () => {
    prisma = {
      expense: {
        create: jest
          .fn<Promise<unknown>, [ExpenseCreateArgs]>()
          .mockImplementation(({ data }) => Promise.resolve(data)),
      },
      group: { findUniqueOrThrow: jest.fn() },
      paymentMethod: { findUnique: jest.fn() },
      groupMember: { findMany: jest.fn() },
    };
    groupsService = {
      assertMembership: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: prisma },
        { provide: GroupsService, useValue: groupsService },
      ],
    }).compile();

    service = module.get(ExpensesService);

    prisma.paymentMethod.findUnique.mockResolvedValue({
      id: PAYMENT_METHOD_ID,
      userId: USER_ID,
    });
  });

  it('no crea splits para el grupo Personal', async () => {
    prisma.group.findUniqueOrThrow.mockResolvedValue({
      id: GROUP_ID,
      isDefault: true,
    });

    await service.create(USER_ID, baseDto());

    const createCall = prisma.expense.create.mock.calls[0][0];
    expect(createCall.data.splits).toBeUndefined();
  });

  it('exige splitStrategy en un grupo no-Personal', async () => {
    prisma.group.findUniqueOrThrow.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
    });

    await expect(service.create(USER_ID, baseDto())).rejects.toThrow(
      BadRequestException,
    );
  });

  it('EQUAL reparte el resto de centavos entre los primeros miembros para que la suma cierre exacto', async () => {
    prisma.group.findUniqueOrThrow.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
    });
    prisma.groupMember.findMany.mockResolvedValue([
      { userId: 'a' },
      { userId: 'b' },
      { userId: 'c' },
    ]);

    await service.create(
      USER_ID,
      baseDto({
        amount: 1000,
        splitStrategy: 'EQUAL' as CreateExpenseDto['splitStrategy'],
      }),
    );

    const splits = prisma.expense.create.mock.calls[0][0].data.splits!.create;
    expect(splits.map((s) => s.amount)).toEqual([334, 333, 333]);
    expect(splits.reduce((sum, s) => sum + s.amount, 0)).toBe(1000);
  });

  it('PERCENTAGE valida que los porcentajes sumen 100 y reconcilia el redondeo', async () => {
    prisma.group.findUniqueOrThrow.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
    });
    prisma.groupMember.findMany.mockResolvedValue([
      { userId: 'a' },
      { userId: 'b' },
    ]);

    await service.create(
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

    const splits = prisma.expense.create.mock.calls[0][0].data.splits!.create;
    expect(splits.reduce((sum, s) => sum + s.amount, 0)).toBe(1000);
  });

  it('PERCENTAGE rechaza porcentajes que no suman 100', async () => {
    prisma.group.findUniqueOrThrow.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
    });
    prisma.groupMember.findMany.mockResolvedValue([
      { userId: 'a' },
      { userId: 'b' },
    ]);

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
    prisma.group.findUniqueOrThrow.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
    });
    prisma.groupMember.findMany.mockResolvedValue([
      { userId: 'a' },
      { userId: 'b' },
    ]);

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
    prisma.group.findUniqueOrThrow.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
    });
    prisma.groupMember.findMany.mockResolvedValue([{ userId: 'a' }]);

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
