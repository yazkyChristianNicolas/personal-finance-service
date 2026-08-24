/** Objeto completo (create) — GET /groups (search) usa el minificado. */
export interface GroupResponseDto {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
}
