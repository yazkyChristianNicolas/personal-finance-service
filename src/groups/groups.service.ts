import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupsRepository } from './groups.repository';
import { GroupsMapper } from './groups.mapper';
import { GroupModel } from './model/group.model';
import { CreateGroupDto } from './dto/request/create-group.dto';
import { GroupResponseDto } from './dto/response/group-response.dto';
import {
  GroupMemberSearchResultDto,
  GroupSearchResultDto,
} from './dto/response/group-search-result.dto';
import {
  buildSearchResponse,
  GenericSearchResponse,
  normalizePage,
  normalizeSize,
  offsetFor,
} from '../common/pagination/pagination.util';

@Injectable()
export class GroupsService {
  constructor(private readonly groupsRepository: GroupsRepository) {}

  /** Crea el grupo "Personal" del usuario si todavía no lo tiene. Idempotente. */
  async ensurePersonalGroupFor(userId: string): Promise<void> {
    if (await this.groupsRepository.hasDefaultGroup(userId)) return;
    await this.groupsRepository.createWithOwner('Personal', true, userId);
  }

  async search(
    userId: string,
    params: { page?: number; size?: number },
  ): Promise<GenericSearchResponse<GroupSearchResultDto>> {
    const page = normalizePage(params.page);
    const size = normalizeSize(params.size);
    const where = { members: { some: { userId } } };

    const [models, totalElements] = await Promise.all([
      this.groupsRepository.search(where, offsetFor(page, size), size),
      this.groupsRepository.count(where),
    ]);

    return buildSearchResponse(
      models.map(GroupsMapper.toSearchResultDto),
      totalElements,
      page,
      size,
    );
  }

  async create(userId: string, dto: CreateGroupDto): Promise<GroupResponseDto> {
    const model = await this.groupsRepository.createWithOwner(
      dto.name,
      false,
      userId,
    );
    return GroupsMapper.toResponseDto(model);
  }

  /** Lanza 404 si el grupo no existe, 403 si existe pero el usuario no es miembro. */
  async assertMembership(userId: string, groupId: string): Promise<void> {
    const { exists, isMember } =
      await this.groupsRepository.findByIdWithMembership(groupId, userId);
    if (!exists) {
      throw new NotFoundException('group_not_found');
    }
    if (!isMember) {
      throw new ForbiddenException('not_a_group_member');
    }
  }

  /** Uso interno entre servicios (ej. ExpensesService quiere saber si el grupo es el Personal). */
  async findById(groupId: string): Promise<GroupModel> {
    const model = await this.groupsRepository.findById(groupId);
    if (!model) {
      throw new NotFoundException('group_not_found');
    }
    return model;
  }

  async searchMembers(
    userId: string,
    groupId: string,
    params: { page?: number; size?: number },
  ): Promise<GenericSearchResponse<GroupMemberSearchResultDto>> {
    await this.assertMembership(userId, groupId);

    const page = normalizePage(params.page);
    const size = normalizeSize(params.size);

    const [models, totalElements] = await Promise.all([
      this.groupsRepository.searchMembers(groupId, offsetFor(page, size), size),
      this.groupsRepository.countMembers(groupId),
    ]);

    return buildSearchResponse(
      models.map(GroupsMapper.toMemberSearchResultDto),
      totalElements,
      page,
      size,
    );
  }

  /** Grupos donde el usuario es miembro — usado por ExpensesService para filtrar implícitamente GET /expenses (regla 226). */
  getMemberGroupIds(userId: string): Promise<string[]> {
    return this.groupsRepository.getMemberGroupIds(userId);
  }

  /** Miembros de un grupo — usado por ExpensesService para calcular splits. Nunca deben tocar GroupsRepository directo. */
  getMemberUserIds(groupId: string): Promise<string[]> {
    return this.groupsRepository.getMemberUserIds(groupId);
  }
}
