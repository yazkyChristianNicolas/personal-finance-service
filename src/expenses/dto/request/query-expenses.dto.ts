import { Expose } from 'class-transformer';
import {
  IsDateString,
  IsISO4217CurrencyCode,
  IsOptional,
  IsString,
} from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';

/**
 * Query params en snake_case (regla 130 de la guideline) mapeados a camelCase vía
 * `@Expose({ name })` — el CaseConversionInterceptor global no toca `request.query`
 * (ver el comentario en case-conversion.interceptor.ts).
 */
export class QueryExpensesDto extends PageQueryDto {
  @Expose({ name: 'date_from' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @Expose({ name: 'date_to' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @Expose({ name: 'group_id' })
  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @Expose({ name: 'payment_method_id' })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;
}
