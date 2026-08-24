import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { PaymentMethodType } from '../../generated/prisma/enums';
import {
  decodeCursor,
  normalizeLimit,
  paginate,
} from '../common/pagination/cursor-pagination.util';

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(userId: string, params: { limit?: number; cursor?: string }) {
    const limit = normalizeLimit(params.limit);
    const decoded = decodeCursor(params.cursor);

    const rows = await this.prisma.paymentMethod.findMany({
      where: {
        userId,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: new Date(decoded.sortValue) } },
                {
                  createdAt: new Date(decoded.sortValue),
                  id: { lt: decoded.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return paginate(rows, limit, params.cursor, (row) => row.createdAt);
  }

  create(userId: string, dto: CreatePaymentMethodDto) {
    const isCredit = dto.type === PaymentMethodType.CREDIT;
    return this.prisma.paymentMethod.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        billingCycleStart: isCredit ? dto.billingCycleStart : null,
        billingCycleEnd: isCredit ? dto.billingCycleEnd : null,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdatePaymentMethodDto) {
    const existing = await this.findOwnedOrThrow(userId, id);
    const nextType = dto.type ?? existing.type;
    const isCredit = nextType === PaymentMethodType.CREDIT;

    return this.prisma.paymentMethod.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        billingCycleStart: isCredit
          ? (dto.billingCycleStart ?? existing.billingCycleStart)
          : null,
        billingCycleEnd: isCredit
          ? (dto.billingCycleEnd ?? existing.billingCycleEnd)
          : null,
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwnedOrThrow(userId, id);
    await this.prisma.paymentMethod.delete({ where: { id } });
  }

  private async findOwnedOrThrow(userId: string, id: string) {
    const paymentMethod = await this.prisma.paymentMethod.findUnique({
      where: { id },
    });
    if (!paymentMethod || paymentMethod.userId !== userId) {
      throw new NotFoundException('payment_method_not_found');
    }
    return paymentMethod;
  }
}
