import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaymentMethodType } from '../../../../generated/prisma/enums';

export class CreatePaymentMethodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEnum(PaymentMethodType)
  type!: PaymentMethodType;

  // Solo aplican (y se persisten) cuando type = CREDIT; ver PaymentMethodsService.
  @ValidateIf(
    (dto: CreatePaymentMethodDto) => dto.type === PaymentMethodType.CREDIT,
  )
  @IsInt()
  @Min(1)
  @Max(31)
  billingCycleStart?: number;

  @ValidateIf(
    (dto: CreatePaymentMethodDto) => dto.type === PaymentMethodType.CREDIT,
  )
  @IsInt()
  @Min(1)
  @Max(31)
  billingCycleEnd?: number;
}
