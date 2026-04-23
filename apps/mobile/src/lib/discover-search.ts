// B-12 — `CommunitySearchQuerySchema` q: min 2, max 50.

export function canQueryCommunitySearch(q: string): boolean {
  const t = q.trim();
  return t.length >= 2 && t.length <= 50;
}
