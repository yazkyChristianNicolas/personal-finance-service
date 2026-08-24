import { Global, Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { KeycloakAuthGuard } from '../common/guards/keycloak-auth.guard';
import { ApiKeyAuthGuard } from '../common/guards/api-key-auth.guard';
import { AuthGuard } from '../common/guards/auth.guard';

/**
 * Global: expone los guards de auth a cualquier módulo sin que cada uno tenga que
 * importar este módulo explícitamente (`@UseGuards(AuthGuard)` alcanza).
 */
@Global()
@Module({
  imports: [UsersModule],
  providers: [KeycloakAuthGuard, ApiKeyAuthGuard, AuthGuard],
  exports: [KeycloakAuthGuard, ApiKeyAuthGuard, AuthGuard],
})
export class AuthModule {}
