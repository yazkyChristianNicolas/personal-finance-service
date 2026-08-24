import { GroupsMapper, GroupMemberRowWithUser } from './groups.mapper';
import { Group } from '../../generated/prisma/client';

const GROUP_ROW: Group = {
  id: 'group-1',
  name: 'Personal',
  isDefault: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const MEMBER_ROW: GroupMemberRowWithUser = {
  id: 'member-1',
  userId: 'user-1',
  groupId: 'group-1',
  role: 'OWNER',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  user: { id: 'user-1', email: 'test@example.com', displayName: 'Test User' },
};

describe('GroupsMapper', () => {
  it('toModel mapea la fila de Prisma al Model', () => {
    expect(GroupsMapper.toModel(GROUP_ROW)).toEqual({
      id: 'group-1',
      name: 'Personal',
      isDefault: true,
      createdAt: GROUP_ROW.createdAt,
    });
  });

  it('toMemberModel aplana el email/displayName del user incluido', () => {
    expect(GroupsMapper.toMemberModel(MEMBER_ROW)).toEqual({
      id: 'member-1',
      userId: 'user-1',
      groupId: 'group-1',
      role: 'OWNER',
      email: 'test@example.com',
      displayName: 'Test User',
      createdAt: MEMBER_ROW.createdAt,
    });
  });

  it('toResponseDto devuelve el Model completo', () => {
    const model = GroupsMapper.toModel(GROUP_ROW);
    expect(GroupsMapper.toResponseDto(model)).toEqual(model);
  });

  it('toSearchResultDto minifica (sin createdAt)', () => {
    const model = GroupsMapper.toModel(GROUP_ROW);
    expect(GroupsMapper.toSearchResultDto(model)).toEqual({
      id: 'group-1',
      name: 'Personal',
      isDefault: true,
    });
  });

  it('toMemberSearchResultDto minifica (sin groupId/createdAt)', () => {
    const model = GroupsMapper.toMemberModel(MEMBER_ROW);
    expect(GroupsMapper.toMemberSearchResultDto(model)).toEqual({
      id: 'member-1',
      userId: 'user-1',
      role: 'OWNER',
      email: 'test@example.com',
      displayName: 'Test User',
    });
  });
});
