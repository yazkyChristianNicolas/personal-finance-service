import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupModel, GroupMemberModel } from './model/group.model';
import { GroupsMapper } from './groups.mapper';

/**
 * Único lugar del módulo que conoce Prisma. Todo lo que entra/sale de acá es
 * GroupModel/GroupMemberModel, nunca la fila cruda del ORM.
 */
@Injectable()
export class GroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hasDefaultGroup(userId: string): Promise<boolean> {
    const existing = await this.prisma.groupMember.findFirst({
      where: { userId, group: { isDefault: true } },
    });
    return existing !== null;
  }

  async createWithOwner(
    name: string,
    isDefault: boolean,
    ownerUserId: string,
  ): Promise<GroupModel> {
    const row = await this.prisma.group.create({
      data: {
        name,
        isDefault,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    return GroupsMapper.toModel(row);
  }

  async search(
    where: { members: { some: { userId: string } } },
    skip: number,
    take: number,
  ): Promise<GroupModel[]> {
    const rows = await this.prisma.group.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });
    return rows.map(GroupsMapper.toModel);
  }

  count(where: { members: { some: { userId: string } } }): Promise<number> {
    return this.prisma.group.count({ where });
  }

  /** Trae el grupo y si `userId` es miembro, en una sola query (evita dos round-trips). */
  async findByIdWithMembership(
    groupId: string,
    userId: string,
  ): Promise<{ exists: boolean; isMember: boolean }> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        members: { where: { userId }, select: { id: true } },
      },
    });
    if (!group) return { exists: false, isMember: false };
    return { exists: true, isMember: group.members.length > 0 };
  }

  async findById(groupId: string): Promise<GroupModel | null> {
    const row = await this.prisma.group.findUnique({ where: { id: groupId } });
    return row ? GroupsMapper.toModel(row) : null;
  }

  async searchMembers(
    groupId: string,
    skip: number,
    take: number,
  ): Promise<GroupMemberModel[]> {
    const rows = await this.prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { id: 'asc' },
      skip,
      take,
    });
    return rows.map(GroupsMapper.toMemberModel);
  }

  countMembers(groupId: string): Promise<number> {
    return this.prisma.groupMember.count({ where: { groupId } });
  }

  /** Grupos donde el usuario es miembro — usado por ExpensesService para filtrar implícitamente. */
  async getMemberGroupIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    return memberships.map((m) => m.groupId);
  }

  /** Miembros de un grupo — usado por ExpensesService para calcular splits. */
  async getMemberUserIds(groupId: string): Promise<string[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { groupId },
      orderBy: { id: 'asc' },
      select: { userId: true },
    });
    return memberships.map((m) => m.userId);
  }
}
