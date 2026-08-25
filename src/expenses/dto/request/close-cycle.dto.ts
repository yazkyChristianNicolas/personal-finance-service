import { IsNotEmpty, IsString } from 'class-validator';

/** Body, no query — el CaseConversionInterceptor global ya convierte snake_case <-> camelCase. */
export class CloseCycleDto {
  @IsString()
  @IsNotEmpty()
  paymentMethodId!: string;
}
