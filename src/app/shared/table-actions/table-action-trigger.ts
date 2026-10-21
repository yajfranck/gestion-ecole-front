/** Une commande masquée après sélection rend le focus au déclencheur du menu. */
export function tableActionTrigger(element: HTMLElement | null): HTMLElement | null {
  return element?.closest('app-table-actions')?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]') ?? element;
}
