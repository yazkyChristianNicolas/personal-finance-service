import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';

export interface KeycloakProfile {
  id: string;
  email: string;
  displayName?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

  /** Sincroniza el User local desde el JWT en el primer request autenticado (spec 4.1). */
  async findOrCreateFromToken(profile: KeycloakProfile) {
    const user = await this.prisma.user.upsert({
      where: { id: profile.id },
      update: { email: profile.email, displayName: profile.displayName },
      create: {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
      },
    });

    await this.groupsService.ensurePersonalGroupFor(user.id);

    return user;
  }
}
