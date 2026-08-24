import {
  buildSearchResponse,
  normalizePage,
  normalizeSize,
  offsetFor,
} from './pagination.util';

describe('pagination.util', () => {
  describe('normalizePage', () => {
    it('default a 1 cuando no se pasa', () => {
      expect(normalizePage(undefined)).toBe(1);
    });

    it.each([0, -1, NaN, Infinity])(
      'default a 1 para valores inválidos (%p)',
      (value) => {
        expect(normalizePage(value)).toBe(1);
      },
    );

    it('trunca decimales', () => {
      expect(normalizePage(2.9)).toBe(2);
    });

    it('devuelve el valor pedido si es válido', () => {
      expect(normalizePage(5)).toBe(5);
    });
  });

  describe('normalizeSize', () => {
    it('default a 20 cuando no se pasa', () => {
      expect(normalizeSize(undefined)).toBe(20);
    });

    it.each([0, -1, NaN])(
      'default a 20 para valores inválidos (%p)',
      (value) => {
        expect(normalizeSize(value)).toBe(20);
      },
    );

    it('cappea en 100', () => {
      expect(normalizeSize(500)).toBe(100);
    });

    it('devuelve el valor pedido si es válido', () => {
      expect(normalizeSize(50)).toBe(50);
    });
  });

  describe('offsetFor', () => {
    it('page 1 -> offset 0', () => {
      expect(offsetFor(1, 20)).toBe(0);
    });

    it('page 3, size 20 -> offset 40', () => {
      expect(offsetFor(3, 20)).toBe(40);
    });
  });

  describe('buildSearchResponse', () => {
    it('arma data + meta con total_pages calculado', () => {
      const result = buildSearchResponse(['a', 'b'], 42, 2, 20);
      expect(result).toEqual({
        data: ['a', 'b'],
        meta: {
          currentPage: 2,
          totalPages: 3,
          pageSize: 20,
          totalElements: 42,
        },
      });
    });

    it('totalPages es 0 si size es 0', () => {
      const result = buildSearchResponse([], 0, 1, 0);
      expect(result.meta.totalPages).toBe(0);
    });
  });
});
