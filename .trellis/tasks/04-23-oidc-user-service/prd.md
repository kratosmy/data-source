# Add OIDC User Service

## Goal
Make the backend use a real `OidcUserService` during OIDC login so custom authority mapping runs for OIDC-based providers and can be debugged locally.

## Requirements
- Add a dedicated OIDC user-service bean and wire it into the OAuth2 login configuration.
- Preserve the existing backend user-context and authority mapping behavior.
- Keep the local-development auth bypass working after the security configuration is made consistent.
- Avoid logging secrets or raw token values while adding any auth diagnostics needed for debugging.
- Verify the behavior with backend tests and, if feasible, a local Keycloak-backed run.

## Acceptance Criteria
- [ ] OIDC login uses a custom `OidcUserService` bean rather than only a generic `OAuth2UserService`.
- [ ] The custom service applies `BackendUserContextMapper` authority mapping to OIDC users.
- [ ] Local profile behavior remains explicit and tested.
- [ ] Security/auth tests pass for the affected backend flows.

## Technical Notes
- The current security files are in an unresolved merge state and must be reconciled as part of this task.
- The implementation should stay inside `panel/src/main/java/com/data/service/core/security/`.
