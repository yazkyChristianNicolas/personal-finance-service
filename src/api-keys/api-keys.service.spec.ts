import { NotFoundException } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysRepository } from './api-keys.repository';

function createMockRepository() {
  return {
    create: jest.fn(),
    search: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    findByHash: jest.fn(),
    touchLastUsed: jest.fn(),
    revoke: jest.fn(),
  };
}

const MODEL = {
  id: 'key-1',
  userId: 'user-1',
  label: 'mcp-agent',
  hash: 'deadbeef',
  createdAt: new Date('2026-01-01'),
  lastUsedAt: null,
  revokedAt: null,
};

describe('ApiKeysService', () => {
  let repository: ReturnType<typeof createMockRepository>;
  let service: ApiKeysService;

  beforeEach(() => {
    repository = createMockRepository();
    service = new ApiKeysService(repository as unknown as ApiKeysRepository);
  });

  describe('create', () => {
    it('genera un valor en texto plano y persiste solo su hash', async () => {
      repository.create.mockResolvedValue(MODEL);
      const result = await service.create('user-1', { label: 'mcp-agent' });

      const [userId, label, hash] = repository.create.mock.calls[0] as [
        string,
        string,
        string,
      ];
      expect(userId).toBe('user-1');
      expect(label).toBe('mcp-agent');
      expect(hash).not.toBe(result.key); // el hash nunca es igual al texto plano
      expect(result.key.startsWith('pfk_')).toBe(true);
      expect(result).not.toHaveProperty('hash');
    });
  });

  describe('search', () => {
    it('pagina y nunca expone el hash', async () => {
      repository.search.mockResolvedValue([MODEL]);
      repository.count.mockResolvedValue(1);
      const result = await service.search('user-1', {});
      expect(result.data[0]).not.toHaveProperty('hash');
      expect(result.data[0].id).toBe('key-1');
    });
  });

  describe('delete', () => {
    it('lanza 404 si no es del usuario', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.delete('user-1', 'key-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('es idempotente: revocar una key ya revocada no hace nada', async () => {
      repository.findById.mockResolvedValue({
        ...MODEL,
        revokedAt: new Date('2026-01-02'),
      });
      await service.delete('user-1', 'key-1');
      expect(repository.revoke).not.toHaveBeenCalled();
    });

    it('revoca si está activa', async () => {
      repository.findById.mockResolvedValue(MODEL);
      await service.delete('user-1', 'key-1');
      expect(repository.revoke).toHaveBeenCalledWith('key-1');
    });
  });

  describe('validateAndTouch', () => {
    it('devuelve null si no existe ninguna key con ese hash', async () => {
      repository.findByHash.mockResolvedValue(null);
      await expect(service.validateAndTouch('pfk_x')).resolves.toBeNull();
      expect(repository.touchLastUsed).not.toHaveBeenCalled();
    });

    it('devuelve null si la key está revocada', async () => {
      repository.findByHash.mockResolvedValue({
        ...MODEL,
        revokedAt: new Date('2026-01-02'),
      });
      await expect(service.validateAndTouch('pfk_x')).resolves.toBeNull();
      expect(repository.touchLastUsed).not.toHaveBeenCalled();
    });

    it('devuelve el userId y actualiza lastUsedAt si la key es válida', async () => {
      repository.findByHash.mockResolvedValue(MODEL);
      await expect(service.validateAndTouch('pfk_x')).resolves.toEqual({
        userId: 'user-1',
      });
      expect(repository.touchLastUsed).toHaveBeenCalledWith('key-1');
    });
  });
});
