export interface InstallmentPlanModel {
  id: string;
  paymentMethodId: string;
  totalAmount: number;
  installmentsCount: number;
  currentInstallment: number;
  completed: boolean;
  createdAt: Date;
}
