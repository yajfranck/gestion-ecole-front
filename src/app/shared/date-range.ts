export function validDateRange(from: string, to: string): boolean {
  const start = Date.parse(from);
  const end = Date.parse(to);
  return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) &&
    Number.isFinite(start) && Number.isFinite(end) && end >= start && (end - start) / 86400000 < 366;
}