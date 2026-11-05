type LoadingPagination = { page: number; pageSize: number; total: number | null };

export function tableLoadingRowCount(pagination?: LoadingPagination): number {
  if (!pagination) return 14;
  const { page, pageSize, total } = pagination;
  // Zero is also used before the initial count arrives. Reserve a full page then.
  if (total === null || total === 0) return pageSize;
  return Math.max(1, Math.min(pageSize, total - (page - 1) * pageSize));
}
