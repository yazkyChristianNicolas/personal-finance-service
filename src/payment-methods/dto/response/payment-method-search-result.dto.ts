import { PaymentMethodType } from '../../../../generated/prisma/enums';

/** Shape reducido para GET /payment-methods (search): sin user_id, billing_cycle_start/end ni created_at. */
export interface PaymentMethodSearchResultDto {
  id: string;
  name: string;
  type: PaymentMethodType;
}
