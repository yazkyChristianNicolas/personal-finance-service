import { PaymentMethodType } from '../../../../generated/prisma/enums';

/** Objeto completo (create/patch) — GET /payment-methods (search) usa el minificado. */
export interface PaymentMethodResponseDto {
  id: string;
  userId: string;
  name: string;
  type: PaymentMethodType;
  billingCycleStart: number | null;
  billingCycleEnd: number | null;
  createdAt: Date;
}
