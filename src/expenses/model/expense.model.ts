export interface ExpenseSplitModel {
  id: string;
  expenseId: string;
  userId: string;
  amount: number;
  percentage: number | null;
}

export interface ExpenseModel {
  id: string;
  date: Date;
  amount: number;
  currency: string;
  description: string;
  category: string;
  groupId: string;
  paymentMethodId: string;
  createdByUserId: string;
  isRecurring: boolean;
  recurringTemplateId: string | null;
  installmentPlanId: string | null;
  installmentNumber: number | null;
  /** Denormalizado desde el InstallmentPlan incluido — null si no es un gasto en cuotas. */
  installmentsCount: number | null;
  installmentsTotalAmount: number | null;
  createdAt: Date;
  splits: ExpenseSplitModel[];
}
