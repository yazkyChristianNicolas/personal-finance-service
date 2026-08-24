import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserModel } from './model/user.model';
import { UsersMapper } from './users.mapper';
import { KeycloakProfile } from './model/keycloak-profile';

/** Único lugar del módulo que conoce Prisma. */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromToken(profile: KeycloakProfile): Promise<UserModel> {
    const row = await this.prisma.user.upsert({
      where: { id: profile.id },
      update: { email: profile.email, displayName: profile.displayName },
      create: {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
      },
    });
    return UsersMapper.toModel(row);
  }

  async findById(id: string): Promise<UserModel | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? UsersMapper.toModel(row) : null;
  }
}
