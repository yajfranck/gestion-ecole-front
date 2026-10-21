export function tokenClaims(token?: string): Record<string, unknown> {
  try {
    const payload = token?.split('.')[1];
    if (!payload) return {};
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return claims && typeof claims === 'object' && !Array.isArray(claims)
      ? claims as Record<string, unknown> : {};
  } catch { return {}; }
}

export function tokenAuthorities(token?: string): string[] {
  const authorities = tokenClaims(token)['authorities'];
  return Array.isArray(authorities)
    ? authorities.filter((value: unknown): value is string => typeof value === 'string') : [];
}
