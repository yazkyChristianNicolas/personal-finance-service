import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { PaymentMethodSearchResultDto } from './dto/payment-method-search-result.dto';
import { PaymentMethodType } from '../../generated/prisma/enums';
import {
  buildSearchResponse,
  GenericSearchResponse,
  normalizePage,
  normalizeSize,
  offsetFor,
} from '../common/pagination/pagination.util';

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    userId: string,
    params: { page?: number; size?: number },
  ): Promise<GenericSearchResponse<PaymentMethodSearchResultDto>> {
    const page = normalizePage(params.page);
    const size = normalizeSize(params.size);
    const where = { userId };

    const [rows, totalElements] = await Promise.all([
      this.prisma.paymentMethod.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offsetFor(page, size),
        take: size,
      }),
      this.prisma.paymentMethod.count({ where }),
    ]);

    const data: PaymentMethodSearchResultDto[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
    }));
    return buildSearchResponse(data, totalElements, page, size);
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

  async patch(userId: string, id: string, dto: UpdatePaymentMethodDto) {
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

  async delete(userId: string, id: string): Promise<void> {
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
