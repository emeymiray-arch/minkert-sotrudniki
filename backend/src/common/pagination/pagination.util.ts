export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export function parsePagination(
  page?: string | number,
  limit?: string | number,
  defaultLimit = 50,
  maxLimit = 100,
) {
  const p = Math.max(1, Math.trunc(Number(page) || 1));
  const l = Math.min(
    maxLimit,
    Math.max(1, Math.trunc(Number(limit) || defaultLimit)),
  );
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function paginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): Paginated<T> {
  return {
    items,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}
