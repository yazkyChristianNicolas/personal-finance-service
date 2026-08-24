import { camelToSnakeDeep, snakeToCamelDeep } from './case-convert.util';

describe('case-convert.util', () => {
  describe('camelToSnakeDeep', () => {
    it('convierte claves de un objeto plano', () => {
      expect(camelToSnakeDeep({ isDefault: true, createdAt: 'x' })).toEqual({
        is_default: true,
        created_at: 'x',
      });
    });

    it('es recursivo en objetos anidados y arrays', () => {
      expect(
        camelToSnakeDeep({ items: [{ groupId: '1' }, { groupId: '2' }] }),
      ).toEqual({
        items: [{ group_id: '1' }, { group_id: '2' }],
      });
    });

    it('no toca instancias de Date', () => {
      const date = new Date('2026-01-01T00:00:00.000Z');
      const result = camelToSnakeDeep({ createdAt: date }) as {
        created_at: Date;
      };
      expect(result.created_at).toBe(date);
    });

    it('no toca instancias de Buffer', () => {
      const buffer = Buffer.from('hola');
      const result = camelToSnakeDeep({ rawData: buffer }) as {
        raw_data: Buffer;
      };
      expect(result.raw_data).toBe(buffer);
    });

    it('deja pasar primitivos sin modificar', () => {
      expect(camelToSnakeDeep('hola')).toBe('hola');
      expect(camelToSnakeDeep(42)).toBe(42);
      expect(camelToSnakeDeep(null)).toBeNull();
    });
  });

  describe('snakeToCamelDeep', () => {
    it('convierte claves de un objeto plano', () => {
      expect(snakeToCamelDeep({ is_default: true, group_id: '1' })).toEqual({
        isDefault: true,
        groupId: '1',
      });
    });

    it('es recursivo en objetos anidados y arrays', () => {
      expect(snakeToCamelDeep({ items: [{ user_id: 'a' }] })).toEqual({
        items: [{ userId: 'a' }],
      });
    });

    it('deja pasar primitivos sin modificar', () => {
      expect(snakeToCamelDeep(true)).toBe(true);
    });
  });
});
