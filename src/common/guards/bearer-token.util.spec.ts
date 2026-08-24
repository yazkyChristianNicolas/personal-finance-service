import { Request } from 'express';
import { extractBearerToken, looksLikeJwt } from './bearer-token.util';

function requestWithAuthHeader(authorization?: string): Request {
  return { headers: { authorization } } as Request;
}

describe('bearer-token.util', () => {
  describe('extractBearerToken', () => {
    it('extrae el token de un header Bearer válido', () => {
      expect(extractBearerToken(requestWithAuthHeader('Bearer abc123'))).toBe(
        'abc123',
      );
    });

    it('devuelve null si no hay header', () => {
      expect(extractBearerToken(requestWithAuthHeader(undefined))).toBeNull();
    });

    it('devuelve null si el header no empieza con "Bearer "', () => {
      expect(
        extractBearerToken(requestWithAuthHeader('Basic abc123')),
      ).toBeNull();
    });

    it('devuelve null si el token queda vacío tras el prefijo', () => {
      expect(extractBearerToken(requestWithAuthHeader('Bearer '))).toBeNull();
    });

    it('recorta espacios alrededor del token', () => {
      expect(
        extractBearerToken(requestWithAuthHeader('Bearer   abc123  ')),
      ).toBe('abc123');
    });
  });

  describe('looksLikeJwt', () => {
    it('true para un token con 3 segmentos', () => {
      expect(looksLikeJwt('header.payload.signature')).toBe(true);
    });

    it('false para una API key propia (sin puntos)', () => {
      expect(looksLikeJwt('pfk_abcdef123456')).toBe(false);
    });

    it('false si tiene una cantidad de segmentos distinta de 3', () => {
      expect(looksLikeJwt('a.b')).toBe(false);
      expect(looksLikeJwt('a.b.c.d')).toBe(false);
    });
  });
});
