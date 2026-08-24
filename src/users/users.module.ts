import { Global, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { GroupsModule } from '../groups/groups.module';

/** Global por la misma razón que GroupsModule: KeycloakAuthGuard (en AuthModule) depende de
 * UsersService, y esa dependencia debe resolverse sin importar AuthModule/UsersModule
 * explícitamente en cada módulo consumidor (groups, expenses, payment-methods, api-keys). */
@Global()
@Module({
  imports: [GroupsModule],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
