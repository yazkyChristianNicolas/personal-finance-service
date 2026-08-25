import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethodsRepository } from './payment-methods.repository';
import { PaymentMethodsMapper } from './payment-methods.mapper';
import { PaymentMethodModel } from './model/payment-method.model';
import { CreatePaymentMethodDto } from './dto/request/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/request/update-payment-method.dto';
import { PaymentMethodResponseDto } from './dto/response/payment-method-response.dto';
import { PaymentMethodSearchResultDto } from './dto/response/payment-method-search-result.dto';
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
  constructor(
    private readonly paymentMethodsRepository: PaymentMethodsRepository,
  ) {}

  async search(
    userId: string,
    params: { page?: number; size?: number },
  ): Promise<GenericSearchResponse<PaymentMethodSearchResultDto>> {
    const page = normalizePage(params.page);
    const size = normalizeSize(params.size);
    const where = { userId };

    const [models, totalElements] = await Promise.all([
      this.paymentMethodsRepository.search(where, offsetFor(page, size), size),
      this.paymentMethodsRepository.count(where),
    ]);

    return buildSearchResponse(
      models.map(PaymentMethodsMapper.toSearchResultDto),
      totalElements,
      page,
      size,
    );
  }

  async create(
    userId: string,
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    const isCredit = dto.type === PaymentMethodType.CREDIT;
    const model = await this.paymentMethodsRepository.create({
      userId,
      name: dto.name,
      type: dto.type,
      billingCycleStart: isCredit ? (dto.billingCycleStart ?? null) : null,
      billingCycleEnd: isCredit ? (dto.billingCycleEnd ?? null) : null,
    });
    return PaymentMethodsMapper.toResponseDto(model);
  }

  async patch(
    userId: string,
    id: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    const existing = await this.findOwnedOrThrow(userId, id);
    const nextType = dto.type ?? existing.type;
    const isCredit = nextType === PaymentMethodType.CREDIT;

    const model = await this.paymentMethodsRepository.update(id, {
      name: dto.name,
      type: dto.type,
      billingCycleStart: isCredit
        ? (dto.billingCycleStart ?? existing.billingCycleStart)
        : null,
      billingCycleEnd: isCredit
        ? (dto.billingCycleEnd ?? existing.billingCycleEnd)
        : null,
    });
    return PaymentMethodsMapper.toResponseDto(model);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.findOwnedOrThrow(userId, id);
    await this.paymentMethodsRepository.delete(id);
  }

  /** Usado por otros módulos (ej. ExpensesService) — nunca deben tocar PaymentMethodsRepository directo. */
  async assertOwnedByUser(
    paymentMethodId: string,
    userId: string,
  ): Promise<void> {
    await this.findOwnedOrThrow(userId, paymentMethodId);
  }

  /** Usado por ExpensesService (cierre de ciclo) — las cuotas solo aplican a tarjetas CREDIT. */
  async assertIsCreditOwnedByUser(
    paymentMethodId: string,
    userId: string,
  ): Promise<void> {
    const model = await this.findOwnedOrThrow(userId, paymentMethodId);
    if (model.type !== PaymentMethodType.CREDIT) {
      throw new BadRequestException('payment_method_is_not_credit');
    }
  }

  private async findOwnedOrThrow(
    userId: string,
    id: string,
  ): Promise<PaymentMethodModel> {
    const model = await this.paymentMethodsRepository.findById(id);
    if (!model || model.userId !== userId) {
      throw new NotFoundException('payment_method_not_found');
    }
    return model;
  }
}
