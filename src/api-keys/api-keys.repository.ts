import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyModel } from './model/api-key.model';
import { ApiKeysMapper } from './api-keys.mapper';

/** Único lugar del módulo que conoce Prisma. */
@Injectable()
export class ApiKeysRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    label: string,
    hash: string,
  ): Promise<ApiKeyModel> {
    const row = await this.prisma.apiKey.create({
      data: { userId, label, hash },
    });
    return ApiKeysMapper.toModel(row);
  }

  async search(
    where: { userId: string },
    skip: number,
    take: number,
  ): Promise<ApiKeyModel[]> {
    const rows = await this.prisma.apiKey.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });
    return rows.map(ApiKeysMapper.toModel);
  }

  count(where: { userId: string }): Promise<number> {
    return this.prisma.apiKey.count({ where });
  }

  async findById(id: string): Promise<ApiKeyModel | null> {
    const row = await this.prisma.apiKey.findUnique({ where: { id } });
    return row ? ApiKeysMapper.toModel(row) : null;
  }

  async findByHash(hash: string): Promise<ApiKeyModel | null> {
    const row = await this.prisma.apiKey.findUnique({ where: { hash } });
    return row ? ApiKeysMapper.toModel(row) : null;
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}
