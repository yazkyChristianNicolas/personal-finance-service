/** Shape reducido para GET /groups (search) — el findById completo no existe todavía para Group. */
export interface GroupSearchResultDto {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface GroupMemberSearchResultDto {
  id: string;
  userId: string;
  role: string;
  email: string;
  displayName: string | null;
}
