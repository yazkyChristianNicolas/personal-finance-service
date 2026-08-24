/** Perfil crudo extraído del JWT verificado — no es un Model de persistencia, es el input
 * que KeycloakAuthGuard le pasa a UsersService para sincronizar el User local. */
export interface KeycloakProfile {
  id: string;
  email: string;
  displayName?: string;
}
