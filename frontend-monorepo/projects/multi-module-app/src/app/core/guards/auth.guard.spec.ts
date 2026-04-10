import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authServiceStub: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  const unauthenticatedRedirect = { redirectedTo: '/auth/login' } as never;

  beforeEach(() => {
    authServiceStub = jasmine.createSpyObj<AuthService>('AuthService', ['initialize', 'isAuthenticated', 'login']);
    authServiceStub.initialize.and.resolveTo();
    routerSpy = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue(unauthenticatedRedirect);

    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: authServiceStub },
        { provide: Router, useValue: routerSpy }
      ]
    });

    guard = TestBed.inject(AuthGuard);
  });

  it('allows navigation for authenticated users', async () => {
    authServiceStub.isAuthenticated.and.returnValue(true);

    const result = await guard.canActivate({} as never, { url: '/workspace' } as never);

    expect(result).toBeTrue();
    expect(authServiceStub.login).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users to the login route with returnUrl', async () => {
    authServiceStub.isAuthenticated.and.returnValue(false);

    const result = await guard.canActivate({} as never, { url: '/workspace' } as never);

    expect(result).toBe(unauthenticatedRedirect);
    expect(authServiceStub.login).not.toHaveBeenCalled();
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/workspace' }
    });
  });
});
