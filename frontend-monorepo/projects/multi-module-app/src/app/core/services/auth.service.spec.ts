import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthConfig, AuthSessionStatus, BackendUserContext } from '../models/auth.models';
import { AuthConfigService } from './auth-config.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTestingController: HttpTestingController | undefined;
  let authConfig: AuthConfig;
  let routerSpy: jasmine.SpyObj<Router>;
  let redirectBrowserSpy: jasmine.Spy;

  const authConfigServiceStub = jasmine.createSpyObj<AuthConfigService>('AuthConfigService', [
    'loadConfig',
    'getConfig'
  ]);

  beforeEach(() => {
    authConfig = {
      mePath: '/api/me',
      sessionPath: '/api/auth/session',
      loginPath: '/api/auth/login',
      logoutPath: '/api/auth/logout',
      defaultReturnUrl: '/'
    };

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate', 'navigateByUrl'], { url: '/workspace' });
    authConfigServiceStub.loadConfig.and.callFake(() => of(authConfig));
    authConfigServiceStub.getConfig.and.callFake(() => authConfig);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: AuthConfigService, useValue: authConfigServiceStub }
      ]
    });

    service = TestBed.inject(AuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
    redirectBrowserSpy = spyOn<any>(service, 'redirectBrowser');
  });

  afterEach(() => {
    httpTestingController?.verify();
  });

  it('loads the current user from /api/me during initialize', async () => {
    const initializePromise = service.initialize();
    await flushAsyncWork();

    const userRequest = httpTestingController!.expectOne('/api/me');
    expect(userRequest.request.method).toBe('GET');
    userRequest.flush(createUserContext());
    await flushAsyncWork();
    flushSessionStatus();

    await expectAsync(initializePromise).toBeResolved();
    expect(service.currentUserValue).toEqual(
      jasmine.objectContaining({
        id: 'backend-user',
        displayName: 'Alex Backend',
        permissions: ['module:xms:read', 'module:xms:export']
      })
    );
    expect('groups' in (service.currentUserValue as object)).toBeFalse();
    expect('entitlements' in (service.currentUserValue as object)).toBeFalse();
    expect('roles' in (service.currentUserValue as object)).toBeFalse();
  });

  it('clears auth state when /api/me returns 401 during initialize', async () => {
    const initializePromise = service.initialize();
    await flushAsyncWork();

    const userRequest = httpTestingController!.expectOne('/api/me');
    userRequest.flush('Unauthorized', {
      status: 401,
      statusText: 'Unauthorized'
    });

    await expectAsync(initializePromise).toBeResolved();
    expect(service.currentUserValue).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('restarts backend login with the current route when the session status is no longer authenticated', async () => {
    const initializePromise = service.initialize();
    await flushAsyncWork();

    httpTestingController!.expectOne('/api/me').flush(createUserContext());
    await flushAsyncWork();

    flushSessionStatus({ authenticated: false, loginUrl: '/api/auth/login' });

    await expectAsync(initializePromise).toBeResolved();
    expect(service.currentUserValue).toBeNull();
    expect(redirectBrowserSpy).toHaveBeenCalledWith('/api/auth/login?returnUrl=%2Fworkspace');
  });

  it('checks the session before expiry and restarts login when the backend session is gone', fakeAsync(() => {
    const initializePromise = service.initialize();
    flushMicrotasks();

    httpTestingController!.expectOne('/api/me').flush(createUserContext());
    flushMicrotasks();

    flushSessionStatus({
      authenticated: true,
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      loginUrl: '/api/auth/login'
    });
    flushMicrotasks();

    let initialized = false;
    void initializePromise.then(() => {
      initialized = true;
    });
    flushMicrotasks();
    expect(initialized).toBeTrue();

    tick(60_000);
    flushSessionStatus({ authenticated: false, loginUrl: '/api/auth/login' });
    flushMicrotasks();

    expect(service.currentUserValue).toBeNull();
    expect(redirectBrowserSpy).toHaveBeenCalledWith('/api/auth/login?returnUrl=%2Fworkspace');
  }));

  it('redirects login to the backend auth entrypoint', async () => {
    await service.login('/workspace');

    expect(redirectBrowserSpy).toHaveBeenCalledWith('/api/auth/login?returnUrl=%2Fworkspace');
  });

  it('redirects logout to the backend auth logout entrypoint', async () => {
    const initializePromise = service.initialize();
    await flushAsyncWork();

    httpTestingController!.expectOne('/api/me').flush(createUserContext());
    await flushAsyncWork();
    flushSessionStatus();
    await expectAsync(initializePromise).toBeResolved();
    service.logout();

    expect(service.currentUserValue).toBeNull();
    expect(redirectBrowserSpy).toHaveBeenCalledWith('/api/auth/logout');
  });

  function createUserContext(): BackendUserContext {
    return {
      id: 'backend-user',
      username: 'alex',
      displayName: 'Alex Backend',
      email: 'alex@example.com',
      permissions: ['module:xms:read', 'module:xms:export'],
      dataScopes: {
        xms: ['book-a', 'book-b']
      }
    };
  }

  function flushSessionStatus(status: AuthSessionStatus = { authenticated: true, loginUrl: '/api/auth/login' }): void {
    const sessionRequest = httpTestingController!.expectOne('/api/auth/session');
    expect(sessionRequest.request.method).toBe('GET');
    sessionRequest.flush(status);
  }

  async function flushAsyncWork(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }
});
