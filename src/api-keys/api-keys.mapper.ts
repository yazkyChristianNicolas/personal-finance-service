import { ApiKey } from '../../generated/prisma/client';
import { ApiKeyModel } from './model/api-key.model';
import { ApiKeySearchResultDto } from './dto/response/api-key-search-result.dto';
import { ApiKeyCreateResponseDto } from './dto/response/api-key-create-response.dto';

/** Métodos estáticos y sin estado: fila Prisma <-> Model <-> DTOs de respuesta. */
export class ApiKeysMapper {
  static toModel(this: void, row: ApiKey): ApiKeyModel {
    return {
      id: row.id,
      userId: row.userId,
      label: row.label,
      hash: row.hash,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
      revokedAt: row.revokedAt,
    };
  }

  static toSearchResultDto(
    this: void,
    model: ApiKeyModel,
  ): ApiKeySearchResultDto {
    return {
      id: model.id,
      label: model.label,
      createdAt: model.createdAt,
      lastUsedAt: model.lastUsedAt,
      revokedAt: model.revokedAt,
    };
  }

  static toCreateResponseDto(
    model: ApiKeyModel,
    plaintextKey: string,
  ): ApiKeyCreateResponseDto {
    return { ...ApiKeysMapper.toSearchResultDto(model), key: plaintextKey };
  }
}
