import { User } from '../../generated/prisma/client';
import { UserModel } from './model/user.model';

export class UsersMapper {
  static toModel(row: User): UserModel {
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      createdAt: row.createdAt,
    };
  }
}
