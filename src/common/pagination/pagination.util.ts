export interface SearchMeta {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalElements: number;
}

export interface GenericSearchResponse<T> {
  data: T[];
  meta: SearchMeta;
}

const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 20;
const MAX_SIZE = 100;

export function normalizePage(page?: number): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return DEFAULT_PAGE;
  }
  return Math.floor(page);
}

export function normalizeSize(size?: number): number {
  if (!size || !Number.isFinite(size) || size <= 0) {
    return DEFAULT_SIZE;
  }
  return Math.min(Math.floor(size), MAX_SIZE);
}

export function offsetFor(page: number, size: number): number {
  return (page - 1) * size;
}

export function buildSearchResponse<T>(
  data: T[],
  totalElements: number,
  page: number,
  size: number,
): GenericSearchResponse<T> {
  return {
    data,
    meta: {
      currentPage: page,
      totalPages: size > 0 ? Math.ceil(totalElements / size) : 0,
      pageSize: size,
      totalElements,
    },
  };
}
