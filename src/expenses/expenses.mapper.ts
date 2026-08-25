import {
  Expense,
  ExpenseSplit,
  InstallmentPlan,
} from '../../generated/prisma/client';
import { ExpenseModel, ExpenseSplitModel } from './model/expense.model';
import { InstallmentPlanModel } from './model/installment-plan.model';
import {
  ExpenseResponseDto,
  ExpenseSplitResponseDto,
} from './dto/response/expense-response.dto';
import { ExpenseSearchResultDto } from './dto/response/expense-search-result.dto';

export interface ExpenseRowWithSplits extends Expense {
  splits: ExpenseSplit[];
  installmentPlan: InstallmentPlan | null;
}

/** Métodos estáticos y sin estado: fila Prisma <-> Model <-> DTOs de respuesta. */
export class ExpensesMapper {
  static toModel(this: void, row: ExpenseRowWithSplits): ExpenseModel {
    return {
      id: row.id,
      date: row.date,
      amount: row.amount,
      currency: row.currency,
      description: row.description,
      category: row.category,
      groupId: row.groupId,
      paymentMethodId: row.paymentMethodId,
      createdByUserId: row.createdByUserId,
      isRecurring: row.isRecurring,
      recurringTemplateId: row.recurringTemplateId,
      installmentPlanId: row.installmentPlanId,
      installmentNumber: row.installmentNumber,
      installmentsCount: row.installmentPlan?.installmentsCount ?? null,
      installmentsTotalAmount: row.installmentPlan?.totalAmount ?? null,
      createdAt: row.createdAt,
      splits: row.splits.map(ExpensesMapper.toSplitModel),
    };
  }

  static toInstallmentPlanModel(
    this: void,
    row: InstallmentPlan,
  ): InstallmentPlanModel {
    return {
      id: row.id,
      paymentMethodId: row.paymentMethodId,
      totalAmount: row.totalAmount,
      installmentsCount: row.installmentsCount,
      currentInstallment: row.currentInstallment,
      completed: row.completed,
      createdAt: row.createdAt,
    };
  }

  static toSplitModel(this: void, row: ExpenseSplit): ExpenseSplitModel {
    return {
      id: row.id,
      expenseId: row.expenseId,
      userId: row.userId,
      amount: row.amount,
      percentage: row.percentage,
    };
  }

  static toResponseDto(this: void, model: ExpenseModel): ExpenseResponseDto {
    return {
      ...model,
      splits: model.splits.map(ExpensesMapper.toSplitResponseDto),
    };
  }

  static toSplitResponseDto(
    this: void,
    model: ExpenseSplitModel,
  ): ExpenseSplitResponseDto {
    return { ...model };
  }

  static toSearchResultDto(
    this: void,
    model: ExpenseModel,
  ): ExpenseSearchResultDto {
    return {
      id: model.id,
      date: model.date,
      amount: model.amount,
      currency: model.currency,
      description: model.description,
      category: model.category,
      groupId: model.groupId,
    };
  }
}
