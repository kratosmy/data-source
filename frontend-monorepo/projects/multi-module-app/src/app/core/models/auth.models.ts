export type AuthorizationMatchMode = 'any' | 'all';

export interface ModuleAuthorization {
  permissions?: string[];
  match?: AuthorizationMatchMode;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  bgStyle: string;
  logo: string;
  authorization?: ModuleAuthorization;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  permissions: string[];
  dataScopes: Record<string, unknown>;
  claims: Record<string, unknown>;
}

export interface AuthConfig {
  mePath: string;
  sessionPath: string;
  loginPath: string;
  logoutPath: string;
  defaultReturnUrl?: string;
}

export interface AuthSessionStatus {
  authenticated: boolean;
  expiresAt?: string;
  loginUrl?: string;
}

export interface BackendUserContext {
  id?: string;
  username?: string;
  displayName?: string;
  email?: string;
  permissions?: string[];
  dataScopes?: Record<string, unknown>;
  claims?: Record<string, unknown>;
}
