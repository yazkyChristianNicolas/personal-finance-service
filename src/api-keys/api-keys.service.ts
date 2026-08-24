import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import {
  buildSearchResponse,
  GenericSearchResponse,
  normalizePage,
  normalizeSize,
  offsetFor,
} from '../common/pagination/pagination.util';

const API_KEY_PREFIX = 'pfk_';

const API_KEY_LIST_SELECT = {
  id: true,
  label: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
} as const;

export interface ApiKeySearchResultDto {
  id: string;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  /** El valor en texto plano se devuelve UNA sola vez acá; nunca vuelve a ser recuperable. */
  async create(userId: string, dto: CreateApiKeyDto) {
    const plaintext = `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
    const hash = hashKey(plaintext);

    const apiKey = await this.prisma.apiKey.create({
      data: { userId, label: dto.label, hash },
      select: API_KEY_LIST_SELECT,
    });

    return { ...apiKey, key: plaintext };
  }

  async search(
    userId: string,
    params: { page?: number; size?: number },
  ): Promise<GenericSearchResponse<ApiKeySearchResultDto>> {
    const page = normalizePage(params.page);
    const size = normalizeSize(params.size);
    const where = { userId };

    const [rows, totalElements] = await Promise.all([
      this.prisma.apiKey.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offsetFor(page, size),
        take: size,
        select: API_KEY_LIST_SELECT,
      }),
      this.prisma.apiKey.count({ where }),
    ]);

    return buildSearchResponse(rows, totalElements, page, size);
  }

  /** Soft-delete: marca revokedAt en vez de borrar la fila (se conserva el historial de uso). */
  async delete(userId: string, id: string): Promise<void> {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!apiKey || apiKey.userId !== userId) {
      throw new NotFoundException('api_key_not_found');
    }
    if (apiKey.revokedAt) {
      return; // idempotente: revocar dos veces no es un error
    }
    await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}

function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}
