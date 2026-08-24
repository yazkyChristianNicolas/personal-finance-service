function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Date) &&
    !(value instanceof Buffer) &&
    !Array.isArray(value)
  );
}

function camelToSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match, char: string) =>
    char.toUpperCase(),
  );
}

function deepConvert(
  value: unknown,
  convertKey: (key: string) => string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => deepConvert(item, convertKey));
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[convertKey(key)] = deepConvert(nested, convertKey);
    }
    return result;
  }
  return value;
}

/** Convierte claves camelCase (código) a snake_case (wire format), recursivo. Rule 118 de la guideline. */
export function camelToSnakeDeep(value: unknown): unknown {
  return deepConvert(value, camelToSnakeKey);
}

/** Convierte claves snake_case (wire format) a camelCase (código), recursivo. */
export function snakeToCamelDeep(value: unknown): unknown {
  return deepConvert(value, snakeToCamelKey);
}
