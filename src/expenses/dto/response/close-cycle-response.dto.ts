import { ExpenseResponseDto } from './expense-response.dto';

export interface CloseCycleResponseDto {
  generatedExpenses: ExpenseResponseDto[];
}
