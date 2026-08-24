/** Shape reducido para GET /expenses (search) — sin splits/payment_method_id/created_at/etc. Ver findById para el objeto completo. */
export interface ExpenseSearchResultDto {
  id: string;
  date: Date;
  amount: number;
  currency: string;
  description: string;
  category: string;
  groupId: string;
}
