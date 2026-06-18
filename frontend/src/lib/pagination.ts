export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export function paginatedQuery(page: number, limit: number) {
  return `page=${page}&limit=${limit}`;
}
