import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { SplitStrategy } from '../../generated/prisma/enums';
import {
  decodeCursor,
  normalizeLimit,
  paginate,
} from '../common/pagination/cursor-pagination.util';

interface ComputedSplit {
  userId: string;
  amount: number;
  percentage?: number;
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

  async create(userId: string, dto: CreateExpenseDto) {
    await this.groupsService.assertMembership(userId, dto.groupId);
    await this.assertOwnsPaymentMethod(userId, dto.paymentMethodId);

    const group = await this.prisma.group.findUniqueOrThrow({
      where: { id: dto.groupId },
    });
    const splits = group.isDefault ? [] : await this.buildSplits(dto);

    return this.prisma.expense.create({
      data: {
        date: new Date(dto.date),
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description,
        category: dto.category,
        groupId: dto.groupId,
        paymentMethodId: dto.paymentMethodId,
        createdByUserId: userId,
        ...(splits.length > 0 ? { splits: { create: splits } } : {}),
      },
      include: { splits: true },
    });
  }

  async findMany(userId: string, query: QueryExpensesDto) {
    const limit = normalizeLimit(query.limit);
    const decoded = decodeCursor(query.cursor);

    const memberGroupIds = query.groupId
      ? await this.oneGroupIdIfMember(userId, query.groupId)
      : await this.groupsService.getMemberGroupIds(userId);

    const rows = await this.prisma.expense.findMany({
      where: {
        groupId: { in: memberGroupIds },
        ...(query.category ? { category: query.category } : {}),
        ...(query.paymentMethodId
          ? { paymentMethodId: query.paymentMethodId }
          : {}),
        ...(query.currency ? { currency: query.currency } : {}),
        ...(query.dateFrom || query.dateTo
          ? {
              date: {
                ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
              },
            }
          : {}),
        ...(decoded
          ? {
              OR: [
                { date: { lt: new Date(decoded.sortValue) } },
                { date: new Date(decoded.sortValue), id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { splits: true },
    });

    return paginate(rows, limit, query.cursor, (row) => row.date);
  }

  async findOne(userId: string, id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { splits: true },
    });
    if (!expense) {
      throw new NotFoundException('expense_not_found');
    }
    await this.groupsService.assertMembership(userId, expense.groupId);
    return expense;
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    const expense = await this.findOne(userId, id);

    if (dto.paymentMethodId) {
      await this.assertOwnsPaymentMethod(userId, dto.paymentMethodId);
    }

    return this.prisma.expense.update({
      where: { id: expense.id },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description,
        category: dto.category,
        paymentMethodId: dto.paymentMethodId,
      },
      include: { splits: true },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const expense = await this.findOne(userId, id);
    await this.prisma.expense.delete({ where: { id: expense.id } });
  }

  private async assertOwnsPaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<void> {
    const paymentMethod = await this.prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId },
    });
    if (!paymentMethod || paymentMethod.userId !== userId) {
      throw new NotFoundException('payment_method_not_found');
    }
  }

  /** Si se filtra por un groupId puntual, igual hay que validar membresía (404/403). */
  private async oneGroupIdIfMember(
    userId: string,
    groupId: string,
  ): Promise<string[]> {
    await this.groupsService.assertMembership(userId, groupId);
    return [groupId];
  }

  private async buildSplits(dto: CreateExpenseDto): Promise<ComputedSplit[]> {
    if (!dto.splitStrategy) {
      throw new BadRequestException(
        'split_strategy_required_for_non_personal_group',
      );
    }

    const members = await this.prisma.groupMember.findMany({
      where: { groupId: dto.groupId },
      orderBy: { id: 'asc' },
    });
    if (members.length === 0) {
      throw new BadRequestException('group_has_no_members');
    }

    switch (dto.splitStrategy) {
      case SplitStrategy.EQUAL:
        return this.splitEqual(
          dto.amount,
          members.map((m) => m.userId),
        );
      case SplitStrategy.PERCENTAGE:
        return this.splitByPercentage(dto);
      case SplitStrategy.ROMANA:
        return this.splitRomana(
          dto,
          members.map((m) => m.userId),
        );
      default:
        throw new BadRequestException('unsupported_split_strategy');
    }
  }

  private splitEqual(
    totalAmount: number,
    memberUserIds: string[],
  ): ComputedSplit[] {
    const base = Math.floor(totalAmount / memberUserIds.length);
    const remainder = totalAmount - base * memberUserIds.length;

    return memberUserIds.map((userId, index) => ({
      userId,
      amount: base + (index < remainder ? 1 : 0),
    }));
  }

  private splitByPercentage(dto: CreateExpenseDto): ComputedSplit[] {
    const splitMembers = dto.splitMembers;
    if (!splitMembers?.length) {
      throw new BadRequestException(
        'split_members_required_for_percentage_strategy',
      );
    }
    const totalPercentage = splitMembers.reduce(
      (sum, m) => sum + (m.percentage ?? 0),
      0,
    );
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new BadRequestException('split_percentages_must_sum_to_100');
    }

    const provisional = splitMembers.map((m) => ({
      userId: m.userId,
      percentage: m.percentage,
      amount: Math.floor((dto.amount * (m.percentage ?? 0)) / 100),
    }));
    return this.reconcileRoundingRemainder(provisional, dto.amount);
  }

  private splitRomana(
    dto: CreateExpenseDto,
    memberUserIds: string[],
  ): ComputedSplit[] {
    const splitMembers = dto.splitMembers;
    if (!splitMembers?.length) {
      throw new BadRequestException(
        'split_members_required_for_romana_strategy',
      );
    }
    const unknownMember = splitMembers.find(
      (m) => !memberUserIds.includes(m.userId),
    );
    if (unknownMember) {
      throw new BadRequestException(
        `user_${unknownMember.userId}_is_not_a_group_member`,
      );
    }
    const totalAmount = splitMembers.reduce(
      (sum, m) => sum + (m.amount ?? 0),
      0,
    );
    if (totalAmount !== dto.amount) {
      throw new BadRequestException('split_amounts_must_sum_to_expense_amount');
    }

    return splitMembers.map((m) => ({
      userId: m.userId,
      amount: m.amount ?? 0,
    }));
  }

  /** Ajusta centavos de redondeo (percentage->amount) para que la suma cierre exacto. */
  private reconcileRoundingRemainder(
    splits: ComputedSplit[],
    totalAmount: number,
  ): ComputedSplit[] {
    const currentSum = splits.reduce((sum, s) => sum + s.amount, 0);
    const remainder = totalAmount - currentSum;
    if (remainder === 0 || splits.length === 0) return splits;

    const adjusted = [...splits];
    adjusted[adjusted.length - 1] = {
      ...adjusted[adjusted.length - 1],
      amount: adjusted[adjusted.length - 1].amount + remainder,
    };
    return adjusted;
  }
}
