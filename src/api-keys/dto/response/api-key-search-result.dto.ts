/** Nunca expone `hash` ni el valor en texto plano — ver api-key-create-response.dto.ts. */
export interface ApiKeySearchResultDto {
  id: string;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}
