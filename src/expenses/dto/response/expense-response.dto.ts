export interface ExpenseSplitResponseDto {
  id: string;
  expenseId: string;
  userId: string;
  amount: number;
  percentage: number | null;
}

/** Objeto completo (findById/create/patch) — GET /expenses (search) usa el minificado. */
export interface ExpenseResponseDto {
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
  installmentsCount: number | null;
  installmentsTotalAmount: number | null;
  createdAt: Date;
  splits: ExpenseSplitResponseDto[];
}
