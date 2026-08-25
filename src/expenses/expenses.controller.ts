import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/request/create-expense.dto';
import { UpdateExpenseDto } from './dto/request/update-expense.dto';
import { QueryExpensesDto } from './dto/request/query-expenses.dto';
import { CloseCycleDto } from './dto/request/close-cycle.dto';

@Controller('expenses')
@UseGuards(AuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryExpensesDto,
  ) {
    return this.expensesService.search(user.userId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(user.userId, dto);
  }

  /**
   * No es una acción CRUD (no hay un "cycle-closure" como recurso propio) —
   * dispara el cierre manual del ciclo de una tarjeta CREDIT: genera la
   * cuota siguiente de cada InstallmentPlan activo de esa tarjeta. Vive acá
   * y no en PaymentMethodsController para no crear una dependencia circular
   * de módulos (ExpensesModule ya importa PaymentMethodsModule).
   */
  @Post('close-cycle')
  closeCycle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloseCycleDto,
  ) {
    return this.expensesService.closeCycle(user.userId, dto);
  }

  @Get(':id')
  findById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.expensesService.findById(user.userId, id);
  }

  @Patch(':id')
  patch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.patch(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.expensesService.delete(user.userId, id);
  }
}
