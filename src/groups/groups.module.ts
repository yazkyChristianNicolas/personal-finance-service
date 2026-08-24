import { Global, Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

/**
 * Global: GroupsService es infraestructura transversal (Auth/Users/Expenses la necesitan) y
 * los guards resueltos vía `@UseGuards(ClassRef)` no siguen imports transitivos entre
 * módulos no-globales — ver el mismo razonamiento en users.module.ts y auth.module.ts.
 */
@Global()
@Module({
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
