import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { ExpenseModel } from './model/expense.model';
import { ExpensesMapper } from './expenses.mapper';

export interface CreateExpenseSplitData {
  userId: string;
  amount: number;
  percentage?: number;
}

export interface CreateExpenseData {
  date: Date;
  amount: number;
  currency: string;
  description: string;
  category: string;
  groupId: string;
  paymentMethodId: string;
  createdByUserId: string;
  splits: CreateExpenseSplitData[];
}

export interface UpdateExpenseData {
  date?: Date;
  amount?: number;
  currency?: string;
  description?: string;
  category?: string;
  paymentMethodId?: string;
}

export interface ExpenseSearchFilter {
  groupIds: string[];
  category?: string;
  paymentMethodId?: string;
  currency?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Único lugar del módulo que conoce Prisma. Todo lo que entra/sale de acá es
 * ExpenseModel, nunca la fila cruda del ORM — incluida la forma exacta del `where`,
 * que se arma acá a partir del filtro plano que manda el Service.
 */
@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateExpenseData): Promise<ExpenseModel> {
    const row = await this.prisma.expense.create({
      data: {
        date: data.date,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        category: data.category,
        groupId: data.groupId,
        paymentMethodId: data.paymentMethodId,
        createdByUserId: data.createdByUserId,
        ...(data.splits.length > 0 ? { splits: { create: data.splits } } : {}),
      },
      include: { splits: true },
    });
    return ExpensesMapper.toModel(row);
  }

  async search(
    filter: ExpenseSearchFilter,
    skip: number,
    take: number,
  ): Promise<ExpenseModel[]> {
    const rows = await this.prisma.expense.findMany({
      where: this.buildWhere(filter),
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      skip,
      take,
      include: { splits: true },
    });
    return rows.map(ExpensesMapper.toModel);
  }

  count(filter: ExpenseSearchFilter): Promise<number> {
    return this.prisma.expense.count({ where: this.buildWhere(filter) });
  }

  async findById(id: string): Promise<ExpenseModel | null> {
    const row = await this.prisma.expense.findUnique({
      where: { id },
      include: { splits: true },
    });
    return row ? ExpensesMapper.toModel(row) : null;
  }

  async update(id: string, data: UpdateExpenseData): Promise<ExpenseModel> {
    const row = await this.prisma.expense.update({
      where: { id },
      data,
      include: { splits: true },
    });
    return ExpensesMapper.toModel(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.expense.delete({ where: { id } });
  }

  private buildWhere(filter: ExpenseSearchFilter): Prisma.ExpenseWhereInput {
    return {
      groupId: { in: filter.groupIds },
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.paymentMethodId
        ? { paymentMethodId: filter.paymentMethodId }
        : {}),
      ...(filter.currency ? { currency: filter.currency } : {}),
      ...(filter.dateFrom || filter.dateTo
        ? {
            date: {
              ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
              ...(filter.dateTo ? { lte: filter.dateTo } : {}),
            },
          }
        : {}),
    };
  }
}
