import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import {
  GroupMemberSearchResultDto,
  GroupSearchResultDto,
} from './dto/group-search-result.dto';
import {
  buildSearchResponse,
  GenericSearchResponse,
  normalizePage,
  normalizeSize,
  offsetFor,
} from '../common/pagination/pagination.util';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea el grupo "Personal" del usuario si todavía no lo tiene. Idempotente. */
  async ensurePersonalGroupFor(userId: string): Promise<void> {
    const existing = await this.prisma.groupMember.findFirst({
      where: { userId, group: { isDefault: true } },
    });
    if (existing) return;

    await this.prisma.group.create({
      data: {
        name: 'Personal',
        isDefault: true,
        members: { create: { userId, role: 'OWNER' } },
      },
    });
  }

  async search(
    userId: string,
    params: { page?: number; size?: number },
  ): Promise<GenericSearchResponse<GroupSearchResultDto>> {
    const page = normalizePage(params.page);
    const size = normalizeSize(params.size);
    const where = { members: { some: { userId } } };

    const [rows, totalElements] = await Promise.all([
      this.prisma.group.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offsetFor(page, size),
        take: size,
      }),
      this.prisma.group.count({ where }),
    ]);

    const data: GroupSearchResultDto[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      isDefault: row.isDefault,
    }));
    return buildSearchResponse(data, totalElements, page, size);
  }

  async create(userId: string, dto: CreateGroupDto) {
    return this.prisma.group.create({
      data: {
        name: dto.name,
        members: { create: { userId, role: 'OWNER' } },
      },
    });
  }

  /** Lanza 404 si el grupo no existe, 403 si existe pero el usuario no es miembro. */
  async assertMembership(userId: string, groupId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        members: { where: { userId }, select: { id: true } },
      },
    });
    if (!group) {
      throw new NotFoundException('group_not_found');
    }
    if (group.members.length === 0) {
      throw new ForbiddenException('not_a_group_member');
    }
  }

  async searchMembers(
    userId: string,
    groupId: string,
    params: { page?: number; size?: number },
  ): Promise<GenericSearchResponse<GroupMemberSearchResultDto>> {
    await this.assertMembership(userId, groupId);

    const page = normalizePage(params.page);
    const size = normalizeSize(params.size);
    const where = { groupId };

    const [rows, totalElements] = await Promise.all([
      this.prisma.groupMember.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, displayName: true } },
        },
        orderBy: { id: 'asc' },
        skip: offsetFor(page, size),
        take: size,
      }),
      this.prisma.groupMember.count({ where }),
    ]);

    const data: GroupMemberSearchResultDto[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      role: row.role,
      email: row.user.email,
      displayName: row.user.displayName,
    }));
    return buildSearchResponse(data, totalElements, page, size);
  }

  /** Grupos donde el usuario es miembro — usado para filtrar implícitamente GET /expenses (regla 226). */
  async getMemberGroupIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    return memberships.map((m) => m.groupId);
  }
}
