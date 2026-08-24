import { ApiKeysRepository } from './api-keys.repository';
import { PrismaService } from '../prisma/prisma.service';

const ROW = {
  id: 'key-1',
  userId: 'user-1',
  label: 'mcp-agent',
  hash: 'deadbeef',
  createdAt: new Date('2026-01-01'),
  lastUsedAt: null,
  revokedAt: null,
};

function createMockPrisma() {
  return {
    apiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn<
        Promise<typeof ROW>,
        [{ where: { id: string }; data: Record<string, unknown> }]
      >(),
    },
  };
}

describe('ApiKeysRepository', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let repository: ApiKeysRepository;

  beforeEach(() => {
    prisma = createMockPrisma();
    repository = new ApiKeysRepository(prisma as unknown as PrismaService);
  });

  it('create persiste con el hash y label dados', async () => {
    prisma.apiKey.create.mockResolvedValue(ROW);
    const result = await repository.create('user-1', 'mcp-agent', 'deadbeef');
    expect(prisma.apiKey.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', label: 'mcp-agent', hash: 'deadbeef' },
    });
    expect(result.id).toBe('key-1');
  });

  it('search mapea las filas encontradas', async () => {
    prisma.apiKey.findMany.mockResolvedValue([ROW]);
    const result = await repository.search({ userId: 'user-1' }, 0, 20);
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe('deadbeef');
  });

  it('count delega en prisma.apiKey.count', async () => {
    prisma.apiKey.count.mockResolvedValue(4);
    await expect(repository.count({ userId: 'user-1' })).resolves.toBe(4);
  });

  it('findById devuelve null si no existe', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    await expect(repository.findById('key-1')).resolves.toBeNull();
  });

  it('findByHash devuelve el modelo mapeado si existe', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(ROW);
    await expect(repository.findByHash('deadbeef')).resolves.toMatchObject({
      id: 'key-1',
    });
    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
      where: { hash: 'deadbeef' },
    });
  });

  it('findByHash devuelve null si no existe', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    await expect(repository.findByHash('nope')).resolves.toBeNull();
  });

  it('touchLastUsed actualiza lastUsedAt', async () => {
    prisma.apiKey.update.mockResolvedValue(ROW);
    await repository.touchLastUsed('key-1');
    const callArgs = prisma.apiKey.update.mock.calls[0][0] as {
      where: unknown;
      data: { lastUsedAt: Date };
    };
    expect(callArgs.where).toEqual({ id: 'key-1' });
    expect(callArgs.data.lastUsedAt).toBeInstanceOf(Date);
  });

  it('revoke actualiza revokedAt', async () => {
    prisma.apiKey.update.mockResolvedValue(ROW);
    await repository.revoke('key-1');
    const callArgs = prisma.apiKey.update.mock.calls[0][0] as {
      where: unknown;
      data: { revokedAt: Date };
    };
    expect(callArgs.where).toEqual({ id: 'key-1' });
    expect(callArgs.data.revokedAt).toBeInstanceOf(Date);
  });
});
