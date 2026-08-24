import { GroupRole } from '../../../generated/prisma/enums';

export interface GroupModel {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface GroupMemberModel {
  id: string;
  userId: string;
  groupId: string;
  role: GroupRole;
  email: string;
  displayName: string | null;
  createdAt: Date;
}
