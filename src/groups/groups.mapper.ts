import { Group, GroupMember } from '../../generated/prisma/client';
import { GroupMemberModel, GroupModel } from './model/group.model';
import { GroupResponseDto } from './dto/response/group-response.dto';
import {
  GroupMemberSearchResultDto,
  GroupSearchResultDto,
} from './dto/response/group-search-result.dto';

export interface GroupMemberRowWithUser extends GroupMember {
  user: { id: string; email: string; displayName: string | null };
}

/** Métodos estáticos y sin estado: fila Prisma <-> Model <-> DTOs de respuesta. */
export class GroupsMapper {
  static toModel(this: void, row: Group): GroupModel {
    return {
      id: row.id,
      name: row.name,
      isDefault: row.isDefault,
      createdAt: row.createdAt,
    };
  }

  static toMemberModel(
    this: void,
    row: GroupMemberRowWithUser,
  ): GroupMemberModel {
    return {
      id: row.id,
      userId: row.userId,
      groupId: row.groupId,
      role: row.role,
      email: row.user.email,
      displayName: row.user.displayName,
      createdAt: row.createdAt,
    };
  }

  static toResponseDto(model: GroupModel): GroupResponseDto {
    return { ...model };
  }

  static toSearchResultDto(
    this: void,
    model: GroupModel,
  ): GroupSearchResultDto {
    return { id: model.id, name: model.name, isDefault: model.isDefault };
  }

  static toMemberSearchResultDto(
    this: void,
    model: GroupMemberModel,
  ): GroupMemberSearchResultDto {
    return {
      id: model.id,
      userId: model.userId,
      role: model.role,
      email: model.email,
      displayName: model.displayName,
    };
  }
}
