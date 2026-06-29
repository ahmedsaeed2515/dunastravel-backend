export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
}

export function getPaginationParams(
  page?: number,
  limit?: number,
): { skip: number; take: number; page: number; limit: number } {
  const p = page === undefined || page < 1 ? 1 : page;
  let l = limit === undefined ? 10 : limit;
  if (l < 1) l = 1;
  if (l > 100) l = 100;

  const skip = (p - 1) * l;

  return { skip, take: l, page: p, limit: l };
}
