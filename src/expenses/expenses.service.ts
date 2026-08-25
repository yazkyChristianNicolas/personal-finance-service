import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExpensesRepository } from './expenses.repository';
import { ExpensesMapper } from './expenses.mapper';
import { ExpenseModel } from './model/expense.model';
import { GroupModel } from '../groups/model/group.model';
import { GroupsService } from '../groups/groups.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { CreateExpenseDto } from './dto/request/create-expense.dto';
import { UpdateExpenseDto } from './dto/request/update-expense.dto';
import { QueryExpensesDto } from './dto/request/query-expenses.dto';
import { CloseCycleDto } from './dto/request/close-cycle.dto';
import { ExpenseResponseDto } from './dto/response/expense-response.dto';
import { ExpenseSearchResultDto } from './dto/response/expense-search-result.dto';
import { CloseCycleResponseDto } from './dto/response/close-cycle-response.dto';
import { SplitStrategy } from '../../generated/prisma/enums';
import {
  buildSearchResponse,
  GenericSearchResponse,
  normalizePage,
  normalizeSize,
  offsetFor,
} from '../common/pagination/pagination.util';

interface ComputedSplit {
  userId: string;
  amount: number;
  percentage?: number;
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly expensesRepository: ExpensesRepository,
    private readonly groupsService: GroupsService,
    private readonly paymentMethodsService: PaymentMethodsService,
  ) {}

  async create(
    userId: string,
    dto: CreateExpenseDto,
  ): Promise<ExpenseResponseDto> {
    await this.groupsService.assertMembership(userId, dto.groupId);
    await this.paymentMethodsService.assertOwnedByUser(
      dto.paymentMethodId,
      userId,
    );

    const group = await this.groupsService.findById(dto.groupId);

    if (dto.installmentsCount) {
      return this.createWithInstallments(userId, dto, group);
    }

    const splits = group.isDefault ? [] : await this.buildSplits(dto);

    // createdAt siempre queda seteado por Prisma (@default(now())), no hace falta pasarlo.
    const model = await this.expensesRepository.create({
      date: new Date(dto.date),
      amount: dto.amount,
      currency: dto.currency,
      description: dto.description,
      category: dto.category,
      groupId: dto.groupId,
      paymentMethodId: dto.paymentMethodId,
      createdByUserId: userId,
      splits,
    });
    return ExpensesMapper.toResponseDto(model);
  }

  /**
   * `dto.amount` es el TOTAL de la compra acá, no el monto de este registro —
   * el monto que se persiste (y se splittea) es la primera cuota
   * (`total / installmentsCount`, redondeada hacia abajo; la última cuota,
   * generada por closeCycle, absorbe el resto).
   */
  private async createWithInstallments(
    userId: string,
    dto: CreateExpenseDto,
    group: GroupModel,
  ): Promise<ExpenseResponseDto> {
    const totalAmount = dto.amount;
    const installmentsCount = dto.installmentsCount!;
    const firstAmount = this.computeInstallmentAmount(
      totalAmount,
      installmentsCount,
      1,
    );
    if (firstAmount < 1) {
      throw new BadRequestException('installments_count_too_high_for_amount');
    }

    const plan = await this.expensesRepository.createInstallmentPlan({
      paymentMethodId: dto.paymentMethodId,
      totalAmount,
      installmentsCount,
    });

    const splits = group.isDefault
      ? []
      : await this.buildSplits({ ...dto, amount: firstAmount });

    const model = await this.expensesRepository.create({
      date: new Date(dto.date),
      amount: firstAmount,
      currency: dto.currency,
      description: dto.description,
      category: dto.category,
      groupId: dto.groupId,
      paymentMethodId: dto.paymentMethodId,
      createdByUserId: userId,
      installmentPlanId: plan.id,
      installmentNumber: 1,
      splits,
    });
    return ExpensesMapper.toResponseDto(model);
  }

  /**
   * Genera la cuota siguiente de cada InstallmentPlan activo de una tarjeta CREDIT
   * cuando corta su ciclo. Disparo manual (POST /expenses/close-cycle) — no hay
   * cron/scheduler todavía, así que no es idempotente: llamarlo dos veces en el
   * mismo ciclo genera dos cuotas para el mismo período.
   */
  async closeCycle(
    userId: string,
    dto: CloseCycleDto,
  ): Promise<CloseCycleResponseDto> {
    await this.paymentMethodsService.assertIsCreditOwnedByUser(
      dto.paymentMethodId,
      userId,
    );

    const activePlans =
      await this.expensesRepository.findActiveInstallmentPlans(
        dto.paymentMethodId,
      );

    const generated: ExpenseModel[] = [];
    for (const plan of activePlans) {
      const sourceExpense =
        await this.expensesRepository.findLatestByInstallmentPlanId(plan.id);
      if (!sourceExpense) continue; // no debería pasar, pero no hay de dónde clonar

      const nextInstallmentNumber = plan.currentInstallment + 1;
      const nextAmount = this.computeInstallmentAmount(
        plan.totalAmount,
        plan.installmentsCount,
        nextInstallmentNumber,
      );
      const splits = this.scaleSplits(
        sourceExpense.splits,
        sourceExpense.amount,
        nextAmount,
      );

      const newExpense = await this.expensesRepository.create({
        date: new Date(),
        amount: nextAmount,
        currency: sourceExpense.currency,
        description: sourceExpense.description,
        category: sourceExpense.category,
        groupId: sourceExpense.groupId,
        paymentMethodId: sourceExpense.paymentMethodId,
        createdByUserId: sourceExpense.createdByUserId,
        installmentPlanId: plan.id,
        installmentNumber: nextInstallmentNumber,
        splits,
      });

      await this.expensesRepository.advanceInstallmentPlan(
        plan.id,
        nextInstallmentNumber,
        nextInstallmentNumber >= plan.installmentsCount,
      );
      generated.push(newExpense);
    }

    return {
      generatedExpenses: generated.map(ExpensesMapper.toResponseDto),
    };
  }

  async search(
    userId: string,
    query: QueryExpensesDto,
  ): Promise<GenericSearchResponse<ExpenseSearchResultDto>> {
    const page = normalizePage(query.page);
    const size = normalizeSize(query.size);

    const groupIds = query.groupId
      ? await this.oneGroupIdIfMember(userId, query.groupId)
      : await this.groupsService.getMemberGroupIds(userId);

    const filter = {
      groupIds,
      category: query.category,
      paymentMethodId: query.paymentMethodId,
      currency: query.currency,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    };

    const [models, totalElements] = await Promise.all([
      this.expensesRepository.search(filter, offsetFor(page, size), size),
      this.expensesRepository.count(filter),
    ]);

    return buildSearchResponse(
      models.map(ExpensesMapper.toSearchResultDto),
      totalElements,
      page,
      size,
    );
  }

  async findById(userId: string, id: string): Promise<ExpenseResponseDto> {
    const model = await this.getModelOrThrow(userId, id);
    return ExpensesMapper.toResponseDto(model);
  }

  async patch(
    userId: string,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<ExpenseResponseDto> {
    const expense = await this.getModelOrThrow(userId, id);

    if (dto.amount !== undefined && expense.installmentPlanId) {
      throw new BadRequestException(
        'cannot_patch_amount_of_installment_expense',
      );
    }

    if (dto.paymentMethodId) {
      await this.paymentMethodsService.assertOwnedByUser(
        dto.paymentMethodId,
        userId,
      );
    }

    const model = await this.expensesRepository.update(expense.id, {
      date: dto.date ? new Date(dto.date) : undefined,
      amount: dto.amount,
      currency: dto.currency,
      description: dto.description,
      category: dto.category,
      paymentMethodId: dto.paymentMethodId,
    });
    return ExpensesMapper.toResponseDto(model);
  }

  async delete(userId: string, id: string): Promise<void> {
    const expense = await this.getModelOrThrow(userId, id);
    await this.expensesRepository.delete(expense.id);
  }

  private async getModelOrThrow(
    userId: string,
    id: string,
  ): Promise<ExpenseModel> {
    const model = await this.expensesRepository.findById(id);
    if (!model) {
      throw new NotFoundException('expense_not_found');
    }
    await this.groupsService.assertMembership(userId, model.groupId);
    return model;
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

    const memberUserIds = await this.groupsService.getMemberUserIds(
      dto.groupId,
    );
    if (memberUserIds.length === 0) {
      throw new BadRequestException('group_has_no_members');
    }

    switch (dto.splitStrategy) {
      case SplitStrategy.EQUAL:
        return this.splitEqual(dto.amount, memberUserIds);
      case SplitStrategy.PERCENTAGE:
        return this.splitByPercentage(dto);
      case SplitStrategy.ROMANA:
        return this.splitRomana(dto, memberUserIds);
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

  /** installmentNumber es 1-indexed; la última cuota absorbe el resto de la división. */
  private computeInstallmentAmount(
    totalAmount: number,
    installmentsCount: number,
    installmentNumber: number,
  ): number {
    const base = Math.floor(totalAmount / installmentsCount);
    if (installmentNumber < installmentsCount) {
      return base;
    }
    return totalAmount - base * (installmentsCount - 1);
  }

  /** Reescala splits existentes a un nuevo monto total, preservando sus proporciones. */
  private scaleSplits(
    originalSplits: {
      userId: string;
      amount: number;
      percentage: number | null;
    }[],
    originalAmount: number,
    newAmount: number,
  ): ComputedSplit[] {
    if (originalSplits.length === 0) return [];

    const provisional = originalSplits.map((s) => ({
      userId: s.userId,
      percentage: s.percentage ?? undefined,
      amount: Math.floor((s.amount * newAmount) / originalAmount),
    }));
    return this.reconcileRoundingRemainder(provisional, newAmount);
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
