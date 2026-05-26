import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, shareReplay, tap } from 'rxjs';

import { AuthConfig } from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthConfigService {
  private config?: AuthConfig;
  private configRequest$?: Observable<AuthConfig>;

  constructor(private readonly http: HttpClient) {}

  loadConfig(): Observable<AuthConfig> {
    if (this.config) {
      return of(this.config);
    }

    if (!this.configRequest$) {
      this.configRequest$ = this.http.get<AuthConfig>('/auth-config.json').pipe(
        map(config => this.normalizeConfig(config)),
        tap(config => {
          this.config = config;
        }),
        shareReplay(1)
      );
    }

    return this.configRequest$;
  }

  getConfig(): AuthConfig {
    if (!this.config) {
      throw new Error('Auth config has not been loaded yet.');
    }

    return this.config;
  }

  private normalizeConfig(config: AuthConfig): AuthConfig {
    return {
      ...config,
      mePath: config.mePath || '/api/me',
      sessionPath: config.sessionPath || '/api/auth/session',
      loginPath: config.loginPath || '/api/auth/login',
      logoutPath: config.logoutPath || '/api/auth/logout',
      defaultReturnUrl: config.defaultReturnUrl || '/'
    };
  }
}
