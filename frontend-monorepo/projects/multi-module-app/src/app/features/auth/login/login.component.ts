import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  protected readonly isStartingLogin = signal(false);
  protected readonly errorMessage = signal('');

  private returnUrl = '/';

  ngOnInit(): void {
    void this.refreshAuthState();
  }

  private async refreshAuthState(): Promise<void> {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
    const routeError = this.route.snapshot.queryParamMap.get('error');

    await this.authService.initialize();

    if (this.authService.isAuthenticated()) {
      void this.router.navigateByUrl(this.returnUrl);
      return;
    }

    if (routeError) {
      this.errorMessage.set(decodeURIComponent(routeError));
    }
  }

  async signIn(): Promise<void> {
    this.isStartingLogin.set(true);
    this.errorMessage.set('');

    try {
      await this.authService.login(this.returnUrl);
    } catch (error) {
      console.error('Failed to start backend sign-in', error);
      this.errorMessage.set('Unable to reach the backend sign-in entrypoint right now.');
      this.isStartingLogin.set(false);
    }
  }
}
