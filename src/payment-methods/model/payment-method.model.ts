import { PaymentMethodType } from '../../../generated/prisma/enums';

/** Entidad de dominio, desacoplada del tipo que genera Prisma. Solo el Repository/Mapper
 * de este módulo conocen la forma exacta de la fila persistida. */
export interface PaymentMethodModel {
  id: string;
  userId: string;
  name: string;
  type: PaymentMethodType;
  billingCycleStart: number | null;
  billingCycleEnd: number | null;
  createdAt: Date;
}
