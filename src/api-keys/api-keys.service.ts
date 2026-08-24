import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ApiKeysRepository } from './api-keys.repository';
import { ApiKeysMapper } from './api-keys.mapper';
import { ApiKeyModel } from './model/api-key.model';
import { CreateApiKeyDto } from './dto/request/create-api-key.dto';
import { ApiKeySearchResultDto } from './dto/response/api-key-search-result.dto';
import { ApiKeyCreateResponseDto } from './dto/response/api-key-create-response.dto';
import {
  buildSearchResponse,
  GenericSearchResponse,
  normalizePage,
  normalizeSize,
  offsetFor,
} from '../common/pagination/pagination.util';

const API_KEY_PREFIX = 'pfk_';

@Injectable()
export class ApiKeysService {
  constructor(private readonly apiKeysRepository: ApiKeysRepository) {}

  /** El valor en texto plano se devuelve UNA sola vez acá; nunca vuelve a ser recuperable. */
  async create(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<ApiKeyCreateResponseDto> {
    const plaintext = `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
    const model = await this.apiKeysRepository.create(
      userId,
      dto.label,
      hashKey(plaintext),
    );
    return ApiKeysMapper.toCreateResponseDto(model, plaintext);
  }

  async search(
    userId: string,
    params: { page?: number; size?: number },
  ): Promise<GenericSearchResponse<ApiKeySearchResultDto>> {
    const page = normalizePage(params.page);
    const size = normalizeSize(params.size);
    const where = { userId };

    const [models, totalElements] = await Promise.all([
      this.apiKeysRepository.search(where, offsetFor(page, size), size),
      this.apiKeysRepository.count(where),
    ]);

    return buildSearchResponse(
      models.map(ApiKeysMapper.toSearchResultDto),
      totalElements,
      page,
      size,
    );
  }

  /** Soft-delete: marca revokedAt en vez de borrar la fila (se conserva el historial de uso). */
  async delete(userId: string, id: string): Promise<void> {
    const model = await this.findOwnedOrThrow(userId, id);
    if (model.revokedAt) {
      return; // idempotente: revocar dos veces no es un error
    }
    await this.apiKeysRepository.revoke(id);
  }

  /**
   * Usado por ApiKeyAuthGuard — nunca debe tocar ApiKeysRepository/Prisma directo.
   * Hashea, busca, valida que no esté revocada, y actualiza lastUsedAt.
   */
  async validateAndTouch(rawKey: string): Promise<{ userId: string } | null> {
    const model = await this.apiKeysRepository.findByHash(hashKey(rawKey));
    if (!model || model.revokedAt) {
      return null;
    }
    await this.apiKeysRepository.touchLastUsed(model.id);
    return { userId: model.userId };
  }

  private async findOwnedOrThrow(
    userId: string,
    id: string,
  ): Promise<ApiKeyModel> {
    const model = await this.apiKeysRepository.findById(id);
    if (!model || model.userId !== userId) {
      throw new NotFoundException('api_key_not_found');
    }
    return model;
  }
}

function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}
