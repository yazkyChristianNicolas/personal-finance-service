import { UsersMapper } from './users.mapper';
import { User } from '../../generated/prisma/client';

const ROW: User = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('UsersMapper', () => {
  it('toModel mapea la fila de Prisma al Model', () => {
    expect(UsersMapper.toModel(ROW)).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      displayName: 'Test User',
      createdAt: ROW.createdAt,
    });
  });
});
