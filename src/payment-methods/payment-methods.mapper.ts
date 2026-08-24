import { PaymentMethod } from '../../generated/prisma/client';
import { PaymentMethodModel } from './model/payment-method.model';
import { PaymentMethodResponseDto } from './dto/response/payment-method-response.dto';
import { PaymentMethodSearchResultDto } from './dto/response/payment-method-search-result.dto';

/** Métodos estáticos y sin estado: fila Prisma <-> Model <-> DTOs de respuesta. */
export class PaymentMethodsMapper {
  static toModel(this: void, row: PaymentMethod): PaymentMethodModel {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      type: row.type,
      billingCycleStart: row.billingCycleStart,
      billingCycleEnd: row.billingCycleEnd,
      createdAt: row.createdAt,
    };
  }

  static toResponseDto(model: PaymentMethodModel): PaymentMethodResponseDto {
    return { ...model };
  }

  static toSearchResultDto(
    this: void,
    model: PaymentMethodModel,
  ): PaymentMethodSearchResultDto {
    return { id: model.id, name: model.name, type: model.type };
  }
}
