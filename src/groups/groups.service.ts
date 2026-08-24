import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import {
  decodeCursor,
  normalizeLimit,
  paginate,
} from '../common/pagination/cursor-pagination.util';

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

  async findMany(userId: string, params: { limit?: number; cursor?: string }) {
    const limit = normalizeLimit(params.limit);
    const decoded = decodeCursor(params.cursor);

    const rows = await this.prisma.group.findMany({
      where: {
        members: { some: { userId } },
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: new Date(decoded.sortValue) } },
                {
                  createdAt: new Date(decoded.sortValue),
                  id: { lt: decoded.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return paginate(rows, limit, params.cursor, (row) => row.createdAt);
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

  async findMembers(userId: string, groupId: string) {
    await this.assertMembership(userId, groupId);
    return this.prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { id: 'asc' },
    });
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
