export function formatMomentDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: '2-digit' }),
  });
}
