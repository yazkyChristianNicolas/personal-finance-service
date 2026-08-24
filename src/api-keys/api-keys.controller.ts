import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { KeycloakAuthGuard } from '../common/guards/keycloak-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { PageQueryDto } from '../common/dto/page-query.dto';

/**
 * Gestión de API Keys: SIEMPRE KeycloakAuthGuard, nunca el AuthGuard compuesto — una API
 * Key no puede usarse para crear/listar/revocar otras API Keys (spec 4.2).
 */
@Controller('api-keys')
@UseGuards(KeycloakAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(user.userId, dto);
  }

  @Get()
  search(@CurrentUser() user: AuthenticatedUser, @Query() query: PageQueryDto) {
    return this.apiKeysService.search(user.userId, query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.apiKeysService.delete(user.userId, id);
  }
}
