import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { GroupsService } from '../groups/groups.service';
import { UserModel } from './model/user.model';
import { KeycloakProfile } from './model/keycloak-profile';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly groupsService: GroupsService,
  ) {}

  /** Sincroniza el User local desde el JWT en el primer request autenticado (spec 4.1). */
  async findOrCreateFromToken(profile: KeycloakProfile): Promise<UserModel> {
    const user = await this.usersRepository.upsertFromToken(profile);
    await this.groupsService.ensurePersonalGroupFor(user.id);
    return user;
  }

  /** Usado por ApiKeyAuthGuard tras resolver el userId de la API Key. */
  async findById(userId: string): Promise<UserModel> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('user_not_found');
    }
    return user;
  }
}
