import {
  IsDateString,
  IsInt,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * No incluye groupId/splitStrategy/splitMembers: cambiar el grupo o la estrategia de un
 * gasto ya splitteado implica recalcular ExpenseSplit y el spec no define esa semántica
 * (queda pendiente si hace falta más adelante).
 */
export class UpdateExpenseDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  paymentMethodId?: string;
}
