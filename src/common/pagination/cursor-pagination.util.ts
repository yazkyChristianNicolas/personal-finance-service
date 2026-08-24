import { BadRequestException } from '@nestjs/common';

export interface CompositeCursor {
  sortValue: string;
  id: string;
}

export interface CursorPageResult<T> {
  items: T[];
  page: {
    limit: number;
    cursor: string | null;
    nextCursor: string | null;
  };
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function normalizeLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

export function decodeCursor(cursor?: string): CompositeCursor | undefined {
  if (!cursor) return undefined;
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<CompositeCursor>;
    if (
      typeof decoded.sortValue === 'string' &&
      typeof decoded.id === 'string'
    ) {
      return decoded as CompositeCursor;
    }
  } catch {
    // fall through to the exception below
  }
  throw new BadRequestException('invalid_cursor');
}

export function encodeCursor(sortValue: Date | string, id: string): string {
  const value = sortValue instanceof Date ? sortValue.toISOString() : sortValue;
  return Buffer.from(JSON.stringify({ sortValue: value, id }), 'utf8').toString(
    'base64url',
  );
}

/**
 * Recorta `rows` (fetcheadas de a `limit + 1`, orden desc por el mismo campo usado en el
 * cursor) a la página pedida y arma el objeto `page`. No calcula total_count (regla 254).
 */
export function paginate<T extends { id: string }>(
  rows: T[],
  limit: number,
  requestedCursor: string | undefined,
  sortValueOf: (row: T) => Date | string,
): CursorPageResult<T> {
  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items,
    page: {
      limit,
      cursor: requestedCursor ?? null,
      nextCursor:
        hasNext && last ? encodeCursor(sortValueOf(last), last.id) : null,
    },
  };
}
