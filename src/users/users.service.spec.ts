import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { GroupsService } from '../groups/groups.service';

const USER_MODEL = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  createdAt: new Date('2026-01-01'),
};

describe('UsersService', () => {
  let usersRepository: { upsertFromToken: jest.Mock; findById: jest.Mock };
  let groupsService: { ensurePersonalGroupFor: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    usersRepository = { upsertFromToken: jest.fn(), findById: jest.fn() };
    groupsService = {
      ensurePersonalGroupFor: jest.fn().mockResolvedValue(undefined),
    };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      groupsService as unknown as GroupsService,
    );
  });

  describe('findOrCreateFromToken', () => {
    it('sincroniza el user y asegura el grupo Personal', async () => {
      usersRepository.upsertFromToken.mockResolvedValue(USER_MODEL);
      const result = await service.findOrCreateFromToken({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      expect(usersRepository.upsertFromToken).toHaveBeenCalledWith({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      expect(groupsService.ensurePersonalGroupFor).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(USER_MODEL);
    });
  });

  describe('findById', () => {
    it('lanza 404 si no existe (usado por ApiKeyAuthGuard)', async () => {
      usersRepository.findById.mockResolvedValue(null);
      await expect(service.findById('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devuelve el Model si existe', async () => {
      usersRepository.findById.mockResolvedValue(USER_MODEL);
      await expect(service.findById('user-1')).resolves.toEqual(USER_MODEL);
    });
  });
});
