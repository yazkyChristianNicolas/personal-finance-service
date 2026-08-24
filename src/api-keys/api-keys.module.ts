import { Global, Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysRepository } from './api-keys.repository';

/** Global por la misma razón que GroupsModule/UsersModule: ApiKeyAuthGuard (en AuthModule)
 * depende de ApiKeysService. */
@Global()
@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeysRepository],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
