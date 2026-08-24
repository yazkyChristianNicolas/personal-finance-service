import { GroupsRepository } from './groups.repository';
import { PrismaService } from '../prisma/prisma.service';

const GROUP_ROW = {
  id: 'group-1',
  name: 'Personal',
  isDefault: true,
  createdAt: new Date('2026-01-01'),
};
const MEMBER_ROW = {
  id: 'member-1',
  userId: 'user-1',
  groupId: 'group-1',
  role: 'OWNER',
  createdAt: new Date('2026-01-01'),
  user: { id: 'user-1', email: 'test@example.com', displayName: null },
};

function createMockPrisma() {
  return {
    groupMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    group: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

describe('GroupsRepository', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let repository: GroupsRepository;

  beforeEach(() => {
    prisma = createMockPrisma();
    repository = new GroupsRepository(prisma as unknown as PrismaService);
  });

  it('hasDefaultGroup devuelve true si existe membresía en un grupo default', async () => {
    prisma.groupMember.findFirst.mockResolvedValue(MEMBER_ROW);
    await expect(repository.hasDefaultGroup('user-1')).resolves.toBe(true);
    expect(prisma.groupMember.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', group: { isDefault: true } },
    });
  });

  it('hasDefaultGroup devuelve false si no existe', async () => {
    prisma.groupMember.findFirst.mockResolvedValue(null);
    await expect(repository.hasDefaultGroup('user-1')).resolves.toBe(false);
  });

  it('createWithOwner crea el grupo con el owner como member y mapea el resultado', async () => {
    prisma.group.create.mockResolvedValue(GROUP_ROW);
    const result = await repository.createWithOwner('Personal', true, 'user-1');
    expect(prisma.group.create).toHaveBeenCalledWith({
      data: {
        name: 'Personal',
        isDefault: true,
        members: { create: { userId: 'user-1', role: 'OWNER' } },
      },
    });
    expect(result).toEqual({
      id: 'group-1',
      name: 'Personal',
      isDefault: true,
      createdAt: GROUP_ROW.createdAt,
    });
  });

  it('search mapea las filas encontradas', async () => {
    prisma.group.findMany.mockResolvedValue([GROUP_ROW]);
    const where = { members: { some: { userId: 'user-1' } } };
    const result = await repository.search(where, 0, 20);
    expect(prisma.group.findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
    });
    expect(result).toEqual([
      {
        id: 'group-1',
        name: 'Personal',
        isDefault: true,
        createdAt: GROUP_ROW.createdAt,
      },
    ]);
  });

  it('count delega en prisma.group.count', async () => {
    prisma.group.count.mockResolvedValue(3);
    const where = { members: { some: { userId: 'user-1' } } };
    await expect(repository.count(where)).resolves.toBe(3);
    expect(prisma.group.count).toHaveBeenCalledWith({ where });
  });

  it('findByIdWithMembership: grupo inexistente', async () => {
    prisma.group.findUnique.mockResolvedValue(null);
    await expect(
      repository.findByIdWithMembership('group-1', 'user-1'),
    ).resolves.toEqual({
      exists: false,
      isMember: false,
    });
  });

  it('findByIdWithMembership: grupo existe, usuario no es miembro', async () => {
    prisma.group.findUnique.mockResolvedValue({ id: 'group-1', members: [] });
    await expect(
      repository.findByIdWithMembership('group-1', 'user-1'),
    ).resolves.toEqual({
      exists: true,
      isMember: false,
    });
  });

  it('findByIdWithMembership: grupo existe, usuario es miembro', async () => {
    prisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      members: [{ id: 'member-1' }],
    });
    await expect(
      repository.findByIdWithMembership('group-1', 'user-1'),
    ).resolves.toEqual({
      exists: true,
      isMember: true,
    });
  });

  it('findById devuelve null si no existe', async () => {
    prisma.group.findUnique.mockResolvedValue(null);
    await expect(repository.findById('group-1')).resolves.toBeNull();
  });

  it('findById mapea la fila si existe', async () => {
    prisma.group.findUnique.mockResolvedValue(GROUP_ROW);
    await expect(repository.findById('group-1')).resolves.toEqual({
      id: 'group-1',
      name: 'Personal',
      isDefault: true,
      createdAt: GROUP_ROW.createdAt,
    });
  });

  it('searchMembers mapea las filas con el user incluido', async () => {
    prisma.groupMember.findMany.mockResolvedValue([MEMBER_ROW]);
    const result = await repository.searchMembers('group-1', 0, 20);
    expect(prisma.groupMember.findMany).toHaveBeenCalledWith({
      where: { groupId: 'group-1' },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { id: 'asc' },
      skip: 0,
      take: 20,
    });
    expect(result[0]).toMatchObject({
      id: 'member-1',
      email: 'test@example.com',
    });
  });

  it('countMembers delega en prisma.groupMember.count', async () => {
    prisma.groupMember.count.mockResolvedValue(2);
    await expect(repository.countMembers('group-1')).resolves.toBe(2);
    expect(prisma.groupMember.count).toHaveBeenCalledWith({
      where: { groupId: 'group-1' },
    });
  });

  it('getMemberGroupIds devuelve la lista de groupId', async () => {
    prisma.groupMember.findMany.mockResolvedValue([
      { groupId: 'group-1' },
      { groupId: 'group-2' },
    ]);
    await expect(repository.getMemberGroupIds('user-1')).resolves.toEqual([
      'group-1',
      'group-2',
    ]);
    expect(prisma.groupMember.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { groupId: true },
    });
  });

  it('getMemberUserIds devuelve la lista de userId', async () => {
    prisma.groupMember.findMany.mockResolvedValue([
      { userId: 'a' },
      { userId: 'b' },
    ]);
    await expect(repository.getMemberUserIds('group-1')).resolves.toEqual([
      'a',
      'b',
    ]);
    expect(prisma.groupMember.findMany).toHaveBeenCalledWith({
      where: { groupId: 'group-1' },
      orderBy: { id: 'asc' },
      select: { userId: true },
    });
  });
});
