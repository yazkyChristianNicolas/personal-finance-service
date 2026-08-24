import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import {
  decodeCursor,
  normalizeLimit,
  paginate,
} from '../common/pagination/cursor-pagination.util';

const API_KEY_PREFIX = 'pfk_';

const API_KEY_LIST_SELECT = {
  id: true,
  label: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
} as const;

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

  async findMany(userId: string, params: { limit?: number; cursor?: string }) {
    const limit = normalizeLimit(params.limit);
    const decoded = decodeCursor(params.cursor);

    const rows = await this.prisma.apiKey.findMany({
      where: {
        userId,
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
      select: API_KEY_LIST_SELECT,
    });

    return paginate(rows, limit, params.cursor, (row) => row.createdAt);
  }

  async revoke(userId: string, id: string): Promise<void> {
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
