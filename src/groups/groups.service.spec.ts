import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsRepository } from './groups.repository';

function createMockRepository() {
  return {
    hasDefaultGroup: jest.fn(),
    createWithOwner: jest.fn(),
    search: jest.fn(),
    count: jest.fn(),
    findByIdWithMembership: jest.fn(),
    findById: jest.fn(),
    searchMembers: jest.fn(),
    countMembers: jest.fn(),
    getMemberGroupIds: jest.fn(),
    getMemberUserIds: jest.fn(),
  };
}

const GROUP_MODEL = {
  id: 'group-1',
  name: 'Personal',
  isDefault: true,
  createdAt: new Date('2026-01-01'),
};
const MEMBER_MODEL = {
  id: 'member-1',
  userId: 'user-1',
  groupId: 'group-1',
  role: 'OWNER' as const,
  email: 'test@example.com',
  displayName: null,
  createdAt: new Date('2026-01-01'),
};

describe('GroupsService', () => {
  let repository: ReturnType<typeof createMockRepository>;
  let service: GroupsService;

  beforeEach(() => {
    repository = createMockRepository();
    service = new GroupsService(repository as unknown as GroupsRepository);
  });

  describe('ensurePersonalGroupFor', () => {
    it('no crea nada si ya tiene un grupo default', async () => {
      repository.hasDefaultGroup.mockResolvedValue(true);
      await service.ensurePersonalGroupFor('user-1');
      expect(repository.createWithOwner).not.toHaveBeenCalled();
    });

    it('crea el grupo Personal si todavía no lo tiene', async () => {
      repository.hasDefaultGroup.mockResolvedValue(false);
      repository.createWithOwner.mockResolvedValue(GROUP_MODEL);
      await service.ensurePersonalGroupFor('user-1');
      expect(repository.createWithOwner).toHaveBeenCalledWith(
        'Personal',
        true,
        'user-1',
      );
    });
  });

  describe('search', () => {
    it('pagina y minifica los resultados', async () => {
      repository.search.mockResolvedValue([GROUP_MODEL]);
      repository.count.mockResolvedValue(1);

      const result = await service.search('user-1', { page: 1, size: 20 });

      expect(repository.search).toHaveBeenCalledWith(
        { members: { some: { userId: 'user-1' } } },
        0,
        20,
      );
      expect(result.data).toEqual([
        { id: 'group-1', name: 'Personal', isDefault: true },
      ]);
      expect(result.meta.totalElements).toBe(1);
    });
  });

  describe('create', () => {
    it('crea el grupo como no-default con el usuario como owner', async () => {
      repository.createWithOwner.mockResolvedValue({
        ...GROUP_MODEL,
        name: 'Roommates',
        isDefault: false,
      });
      const result = await service.create('user-1', { name: 'Roommates' });
      expect(repository.createWithOwner).toHaveBeenCalledWith(
        'Roommates',
        false,
        'user-1',
      );
      expect(result.name).toBe('Roommates');
    });
  });

  describe('assertMembership', () => {
    it('lanza 404 si el grupo no existe', async () => {
      repository.findByIdWithMembership.mockResolvedValue({
        exists: false,
        isMember: false,
      });
      await expect(
        service.assertMembership('user-1', 'group-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 403 si el grupo existe pero el usuario no es miembro', async () => {
      repository.findByIdWithMembership.mockResolvedValue({
        exists: true,
        isMember: false,
      });
      await expect(
        service.assertMembership('user-1', 'group-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('no lanza nada si el usuario es miembro', async () => {
      repository.findByIdWithMembership.mockResolvedValue({
        exists: true,
        isMember: true,
      });
      await expect(
        service.assertMembership('user-1', 'group-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('findById', () => {
    it('lanza 404 si no existe', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findById('group-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devuelve el Model si existe', async () => {
      repository.findById.mockResolvedValue(GROUP_MODEL);
      await expect(service.findById('group-1')).resolves.toEqual(GROUP_MODEL);
    });
  });

  describe('searchMembers', () => {
    it('valida membresía antes de listar', async () => {
      repository.findByIdWithMembership.mockResolvedValue({
        exists: true,
        isMember: true,
      });
      repository.searchMembers.mockResolvedValue([MEMBER_MODEL]);
      repository.countMembers.mockResolvedValue(1);

      const result = await service.searchMembers('user-1', 'group-1', {});

      expect(result.data).toEqual([
        {
          id: 'member-1',
          userId: 'user-1',
          role: 'OWNER',
          email: 'test@example.com',
          displayName: null,
        },
      ]);
    });

    it('propaga el error de membresía sin listar', async () => {
      repository.findByIdWithMembership.mockResolvedValue({
        exists: false,
        isMember: false,
      });
      await expect(
        service.searchMembers('user-1', 'group-1', {}),
      ).rejects.toThrow(NotFoundException);
      expect(repository.searchMembers).not.toHaveBeenCalled();
    });
  });

  it('getMemberGroupIds delega en el repository', async () => {
    repository.getMemberGroupIds.mockResolvedValue(['group-1']);
    await expect(service.getMemberGroupIds('user-1')).resolves.toEqual([
      'group-1',
    ]);
  });

  it('getMemberUserIds delega en el repository', async () => {
    repository.getMemberUserIds.mockResolvedValue(['user-1']);
    await expect(service.getMemberUserIds('group-1')).resolves.toEqual([
      'user-1',
    ]);
  });
});
