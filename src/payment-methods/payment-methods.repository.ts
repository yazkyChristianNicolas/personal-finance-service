import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethodType } from '../../generated/prisma/enums';
import { PaymentMethodModel } from './model/payment-method.model';
import { PaymentMethodsMapper } from './payment-methods.mapper';

export interface CreatePaymentMethodData {
  userId: string;
  name: string;
  type: PaymentMethodType;
  billingCycleStart: number | null;
  billingCycleEnd: number | null;
}

export interface UpdatePaymentMethodData {
  name?: string;
  type?: PaymentMethodType;
  billingCycleStart: number | null;
  billingCycleEnd: number | null;
}

/**
 * Único lugar del módulo que conoce Prisma. Todo lo que entra/sale de acá es
 * PaymentMethodModel, nunca la fila cruda del ORM.
 */
@Injectable()
export class PaymentMethodsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    where: { userId: string },
    skip: number,
    take: number,
  ): Promise<PaymentMethodModel[]> {
    const rows = await this.prisma.paymentMethod.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });
    return rows.map(PaymentMethodsMapper.toModel);
  }

  count(where: { userId: string }): Promise<number> {
    return this.prisma.paymentMethod.count({ where });
  }

  async create(data: CreatePaymentMethodData): Promise<PaymentMethodModel> {
    const row = await this.prisma.paymentMethod.create({ data });
    return PaymentMethodsMapper.toModel(row);
  }

  async update(
    id: string,
    data: UpdatePaymentMethodData,
  ): Promise<PaymentMethodModel> {
    const row = await this.prisma.paymentMethod.update({ where: { id }, data });
    return PaymentMethodsMapper.toModel(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.paymentMethod.delete({ where: { id } });
  }

  async findById(id: string): Promise<PaymentMethodModel | null> {
    const row = await this.prisma.paymentMethod.findUnique({ where: { id } });
    return row ? PaymentMethodsMapper.toModel(row) : null;
  }
}
