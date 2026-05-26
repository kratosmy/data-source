import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

import { AuthConfig, AuthSessionStatus, AuthUser, BackendUserContext } from '../models/auth.models';
import { AuthConfigService } from './auth-config.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private static readonly sessionRefreshLeadMillis = 60_000;
  private static readonly minimumSessionRefreshDelayMillis = 5_000;

  private readonly httpBackend = inject(HttpBackend);
  private readonly authConfigService = inject(AuthConfigService);
  private readonly router = inject(Router);
  private readonly authHttp = new HttpClient(this.httpBackend);

  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  private sessionRefreshTimeoutId: number | undefined;
  private loginRedirectInProgress = false;

  readonly currentUser$ = this.currentUserSubject.asObservable();

  async initialize(): Promise<void> {
    const authConfig = await firstValueFrom(this.authConfigService.loadConfig());
    await this.loadCurrentUser(authConfig);
  }

  async login(returnUrl?: string): Promise<void> {
    const authConfig = await firstValueFrom(this.authConfigService.loadConfig());
    this.redirectToLogin(authConfig.loginPath, returnUrl || authConfig.defaultReturnUrl);
  }

  logout(): void {
    this.clearCurrentUser();
    this.redirectBrowser(this.getOptionalConfig()?.logoutPath || '/api/auth/logout');
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  get currentUserValue(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  private async loadCurrentUser(authConfig: AuthConfig): Promise<void> {
    try {
      const backendUserContext = await firstValueFrom(this.authHttp.get<BackendUserContext>(authConfig.mePath));
      this.currentUserSubject.next(this.mapBackendUserContext(backendUserContext));
      await this.loadSessionStatus(authConfig);
    } catch (error) {
      this.clearCurrentUser();

      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        console.error('Failed to load current user context', error);
      }
    }
  }

  private async loadSessionStatus(authConfig: AuthConfig): Promise<void> {
    try {
      const sessionStatus = await firstValueFrom(this.authHttp.get<AuthSessionStatus>(authConfig.sessionPath));
      if (!sessionStatus.authenticated) {
        this.clearCurrentUser();
        this.redirectToLogin(
          sessionStatus.loginUrl || authConfig.loginPath,
          this.router.url || authConfig.defaultReturnUrl
        );
        return;
      }

      this.scheduleSessionRefresh(authConfig, sessionStatus.expiresAt);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.clearCurrentUser();
        this.redirectToLogin(authConfig.loginPath, this.router.url || authConfig.defaultReturnUrl);
        return;
      }

      console.error('Failed to load auth session status', error);
    }
  }

  private mapBackendUserContext(userContext: BackendUserContext): AuthUser {
    const permissions = this.uniqueList(this.normalizeList(userContext.permissions));
    const username = this.firstDefinedValue(userContext.username, userContext.email, userContext.id) || 'unknown-user';

    return {
      id: this.firstDefinedValue(userContext.id, username) || username,
      username,
      displayName: this.firstDefinedValue(userContext.displayName, username) || username,
      email: this.normalizeString(userContext.email),
      permissions,
      dataScopes: userContext.dataScopes ?? {},
      claims: userContext.claims ?? {}
    };
  }

  private appendReturnUrl(path: string, returnUrl: string): string {
    const query = new URLSearchParams({ returnUrl });
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}${query.toString()}`;
  }

  private scheduleSessionRefresh(authConfig: AuthConfig, expiresAt: string | undefined): void {
    this.clearSessionRefreshTimeout();

    const expiresAtMillis = Date.parse(expiresAt || '');
    if (Number.isNaN(expiresAtMillis)) {
      return;
    }

    const refreshDelay = Math.max(
      expiresAtMillis - Date.now() - AuthService.sessionRefreshLeadMillis,
      AuthService.minimumSessionRefreshDelayMillis
    );

    this.sessionRefreshTimeoutId = window.setTimeout(() => {
      void this.loadSessionStatus(authConfig);
    }, refreshDelay);
  }

  private clearSessionRefreshTimeout(): void {
    if (this.sessionRefreshTimeoutId === undefined) {
      return;
    }

    window.clearTimeout(this.sessionRefreshTimeoutId);
    this.sessionRefreshTimeoutId = undefined;
  }

  private redirectToLogin(loginPath: string, returnUrl: string | undefined): void {
    if (this.loginRedirectInProgress) {
      return;
    }

    this.loginRedirectInProgress = true;
    const nextReturnUrl = this.normalizeReturnUrl(returnUrl);
    this.redirectBrowser(this.appendReturnUrl(loginPath, nextReturnUrl));
  }

  private normalizeReturnUrl(returnUrl: string | undefined): string {
    return this.normalizeString(returnUrl) || '/';
  }

  private normalizeString(value: string | undefined): string | undefined {
    const trimmedValue = value?.trim();
    return trimmedValue ? trimmedValue : undefined;
  }

  private normalizeList(values: string[] | undefined): string[] {
    return (values ?? []).map(value => value.trim()).filter(value => value.length > 0);
  }

  private uniqueList(values: string[]): string[] {
    return Array.from(new Set(values.map(value => value.trim()).filter(value => value.length > 0)));
  }

  private firstDefinedValue(...values: Array<string | undefined>): string | undefined {
    return values.map(value => this.normalizeString(value)).find((value): value is string => !!value);
  }

  private clearCurrentUser(): void {
    this.clearSessionRefreshTimeout();
    this.currentUserSubject.next(null);
  }

  private redirectBrowser(url: string): void {
    window.location.assign(url);
  }

  private getOptionalConfig(): AuthConfig | undefined {
    try {
      return this.authConfigService.getConfig();
    } catch {
      return undefined;
    }
  }
}
