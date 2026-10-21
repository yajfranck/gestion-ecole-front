/** Métadonnées de portée facultatives ; le JWT backend actuel ne fournit que `authorities`. */
export interface AuthorizationSnapshot {
  permissions: string[];
  platformScope: boolean;
  platformPermissions: string[];
  establishmentPermissions: Record<string, string[]>;
}
