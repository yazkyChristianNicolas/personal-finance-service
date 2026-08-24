import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { SplitStrategy } from '../../../../generated/prisma/enums';
import { ExpenseSplitMemberDto } from './expense-split-member.dto';

export class CreateExpenseDto {
  @IsDateString()
  date!: string;

  /** Centavos. Nunca float (spec 2). */
  @IsInt()
  @Min(1)
  amount!: number;

  @IsISO4217CurrencyCode()
  currency!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  groupId!: string;

  @IsString()
  @IsNotEmpty()
  paymentMethodId!: string;

  /** Requerido si groupId no es el grupo "Personal" del creador; ver ExpensesService. */
  @IsOptional()
  @IsEnum(SplitStrategy)
  splitStrategy?: SplitStrategy;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseSplitMemberDto)
  splitMembers?: ExpenseSplitMemberDto[];
}
