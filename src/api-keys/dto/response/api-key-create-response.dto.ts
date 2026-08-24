import { ApiKeySearchResultDto } from './api-key-search-result.dto';

/** El valor en texto plano (`key`) solo aparece en la respuesta de POST /api-keys — nunca
 * se puede volver a recuperar después. */
export interface ApiKeyCreateResponseDto extends ApiKeySearchResultDto {
  key: string;
}
