# Authentication Documentation

This document summarizes the authentication-related files in the frontend and backend of the project.

## Backend (Java/Spring Security)
Located in: panel/src/main/java/com/data/service/core/security/

*   **SecurityConfiguration.java**: The main Spring Security configuration file. It sets up multiple security filter chains:
    *   grafanaSecurityFilterChain: Secures /api/grafana/** using X.509 certificate authentication (extracting the subject principal from the certificate) and ApplicationClientUserDetailsService.
    *   pplicationSecurityFilterChain: Secures application endpoints (/api/user/**, /api/me, /api/auth/**). It configures OAuth2 Login (using oauth2UserService and ReturnUrlAuthenticationSuccessHandler), logout handling (LogoutSuccessHandler redirecting to PingFederate), and permits access to login/logout and optional H2 console endpoints.
    *   It also maps OAuth2 user attributes to granted authorities using BackendUserContextMapper.
*   **PanelSecurityProperties.java**: Configuration properties class for security settings (e.g., PingFederate endpoints, H2 console enablement).
*   **ApplicationClientUserDetailsService.java**: Service for loading user details based on the X.509 certificate principal.
*   **ApplicationClientPrincipal.java**: Represents the principal for application clients.
*   **BackendUserContextMapper.java**: Maps backend user context data (like attributes from OAuth2) to Spring Security GrantedAuthority objects.
*   **ReturnUrlAuthenticationSuccessHandler.java**: Handles successful authentication by redirecting the user to a previously requested URL.
*   **AuthController.java**: REST controller handling authentication-related endpoints (like explicit login/logout triggers if applicable).
*   **CurrentUserController.java**: REST controller providing endpoints (e.g., /api/me) to fetch the currently authenticated user's details.
*   **GrafanaController.java**: Controller handling specific Grafana integration authentication or requests.

## Frontend (Angular)
Located in: rontend-monorepo/projects/multi-module-app/src/app/

*   **core/services/auth.service.ts**: The core authentication service. It manages the current user state (currentUser$), handles login (redirecting to the backend login path with a return URL), logout, and initialization (fetching the /api/me endpoint to load the user context).
*   **core/services/auth-config.service.ts**: Service responsible for loading authentication configuration settings.
*   **core/services/authorization.service.ts**: Service handling authorization logic, checking if a user has specific permissions or roles to access resources.
*   **core/models/auth.models.ts**: Interfaces and types related to authentication, such as AuthUser, BackendUserContext, and AuthConfig.
*   **core/interceptors/api.interceptor.ts**: HTTP interceptor that likely adds necessary authentication headers or handles 401 Unauthorized responses globally.
*   **core/guards/auth.guard.ts**: Angular route guard that prevents access to protected routes if the user is not authenticated.
*   **core/guards/module-access.guard.ts**: Angular route guard that checks if the authenticated user has the necessary permissions to access a specific feature module.
*   **eatures/auth/login/login.component.ts**: Component for the login UI or handling login logic before redirection.
*   **eatures/auth/access-denied/access-denied.component.ts**: Component displayed when a user attempts to access a route they are not authorized for.
