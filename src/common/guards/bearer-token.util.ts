import { Request } from 'express';

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/** Heurística simple: un JWT tiene 3 segmentos separados por punto; una API key propia no. */
export function looksLikeJwt(token: string): boolean {
  return token.split('.').length === 3;
}
