import { AppError } from './app-error.js';

export type OffsetPagination = {
  page: number;
  limit: number;
  offset: number;
};

export type OffsetPage<T> = {
  data: T[];
  pagination: OffsetPagination & {
    total: number;
    totalPages: number;
  };
};

export type CursorPagination = {
  limit: number;
  cursor?: string;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInteger(value: unknown, fallback: number, field: string): number {
  if (value === undefined) {
    return fallback;
  }

  const parsedValue = typeof value === 'string' ? Number(value) : value;

  if (typeof parsedValue !== 'number' || !Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new AppError(400, 'INVALID_PAGINATION', `${field} must be a positive integer.`);
  }

  return parsedValue;
}

export function parseOffsetPagination(query: {
  page?: unknown;
  limit?: unknown;
}): OffsetPagination {
  const page = parsePositiveInteger(query.page, DEFAULT_PAGE, 'page');
  const requestedLimit = parsePositiveInteger(query.limit, DEFAULT_LIMIT, 'limit');
  const limit = Math.min(requestedLimit, MAX_LIMIT);

  return { page, limit, offset: (page - 1) * limit };
}

export function createOffsetPage<T>(
  data: T[],
  total: number,
  pagination: OffsetPagination,
): OffsetPage<T> {
  return {
    data,
    pagination: {
      ...pagination,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

export function parseCursorPagination(query: {
  limit?: unknown;
  cursor?: unknown;
}): CursorPagination {
  const limit = Math.min(parsePositiveInteger(query.limit, DEFAULT_LIMIT, 'limit'), MAX_LIMIT);

  if (query.cursor !== undefined && (typeof query.cursor !== 'string' || !query.cursor)) {
    throw new AppError(400, 'INVALID_CURSOR', 'cursor must be a non-empty string.');
  }

  return { limit, ...(query.cursor ? { cursor: query.cursor } : {}) };
}

export function encodeCursor<T extends object>(value: T): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor<T extends object>(cursor: string): T {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid cursor payload');
    }

    return value as T;
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'cursor is invalid.');
  }
}
