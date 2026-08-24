import { ApiKeysMapper } from './api-keys.mapper';
import { ApiKey } from '../../generated/prisma/client';

const ROW: ApiKey = {
  id: 'key-1',
  userId: 'user-1',
  label: 'mcp-agent',
  hash: 'deadbeef',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastUsedAt: null,
  revokedAt: null,
};

describe('ApiKeysMapper', () => {
  it('toModel mapea la fila de Prisma al Model (incluye hash)', () => {
    expect(ApiKeysMapper.toModel(ROW)).toEqual({
      id: 'key-1',
      userId: 'user-1',
      label: 'mcp-agent',
      hash: 'deadbeef',
      createdAt: ROW.createdAt,
      lastUsedAt: null,
      revokedAt: null,
    });
  });

  it('toSearchResultDto nunca expone el hash', () => {
    const model = ApiKeysMapper.toModel(ROW);
    const dto = ApiKeysMapper.toSearchResultDto(model);
    expect(dto).not.toHaveProperty('hash');
    expect(dto).toEqual({
      id: 'key-1',
      label: 'mcp-agent',
      createdAt: ROW.createdAt,
      lastUsedAt: null,
      revokedAt: null,
    });
  });

  it('toCreateResponseDto agrega el key en texto plano sin exponer el hash', () => {
    const model = ApiKeysMapper.toModel(ROW);
    const dto = ApiKeysMapper.toCreateResponseDto(model, 'pfk_plaintext');
    expect(dto).not.toHaveProperty('hash');
    expect(dto.key).toBe('pfk_plaintext');
    expect(dto.id).toBe('key-1');
  });
});
