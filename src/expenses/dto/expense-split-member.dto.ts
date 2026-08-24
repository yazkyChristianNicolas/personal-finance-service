import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ExpenseSplitMemberDto {
  @IsString()
  userId!: string;

  /** Requerido para splitStrategy=PERCENTAGE (0-100). Ignorado para EQUAL. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  percentage?: number;

  /**
   * Monto en centavos ya calculado por el cliente. Requerido para splitStrategy=ROMANA:
   * el modelo no tiene un campo de "ingreso" u otro criterio propio para derivarlo
   * automáticamente, así que el cliente decide la proporción y la API solo valida que
   * los montos sumen el total del gasto.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}
