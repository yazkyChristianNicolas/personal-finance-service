import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

const USER: AuthenticatedUser = {
  userId: 'user-1',
  email: 'test@example.com',
  displayName: null,
  authMethod: 'keycloak',
};

describe('GroupsController', () => {
  let service: {
    search: jest.Mock;
    create: jest.Mock;
    searchMembers: jest.Mock;
  };
  let controller: GroupsController;

  beforeEach(() => {
    service = {
      search: jest.fn(),
      create: jest.fn(),
      searchMembers: jest.fn(),
    };
    controller = new GroupsController(service as unknown as GroupsService);
  });

  it('search delega en el service con el userId del token', async () => {
    await controller.search(USER, { page: 1, size: 20 });
    expect(service.search).toHaveBeenCalledWith('user-1', {
      page: 1,
      size: 20,
    });
  });

  it('create delega en el service con el userId del token', async () => {
    await controller.create(USER, { name: 'Roommates' });
    expect(service.create).toHaveBeenCalledWith('user-1', {
      name: 'Roommates',
    });
  });

  it('searchMembers delega en el service con el groupId del path', async () => {
    await controller.searchMembers(USER, 'group-1', {});
    expect(service.searchMembers).toHaveBeenCalledWith('user-1', 'group-1', {});
  });
});
