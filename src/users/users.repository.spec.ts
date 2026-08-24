import { UsersRepository } from './users.repository';
import { PrismaService } from '../prisma/prisma.service';

const ROW = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  createdAt: new Date('2026-01-01'),
};

function createMockPrisma() {
  return {
    user: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

describe('UsersRepository', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let repository: UsersRepository;

  beforeEach(() => {
    prisma = createMockPrisma();
    repository = new UsersRepository(prisma as unknown as PrismaService);
  });

  it('upsertFromToken hace upsert por id y mapea el resultado', async () => {
    prisma.user.upsert.mockResolvedValue(ROW);
    const result = await repository.upsertFromToken({
      id: 'user-1',
      email: 'test@example.com',
      displayName: 'Test User',
    });
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      update: { email: 'test@example.com', displayName: 'Test User' },
      create: {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
      },
    });
    expect(result.id).toBe('user-1');
  });

  it('findById devuelve null si no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(repository.findById('user-1')).resolves.toBeNull();
  });

  it('findById mapea la fila si existe', async () => {
    prisma.user.findUnique.mockResolvedValue(ROW);
    await expect(repository.findById('user-1')).resolves.toMatchObject({
      id: 'user-1',
      email: 'test@example.com',
    });
  });
});
