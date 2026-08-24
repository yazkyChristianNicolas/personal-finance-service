/** Entidad de dominio. `hash` nunca sale de este módulo (Repository/Service) hacia un DTO
 * de respuesta — ver ApiKeysMapper. */
export interface ApiKeyModel {
  id: string;
  userId: string;
  label: string;
  hash: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}
