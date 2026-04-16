# Dual-Chain Spring Security Deployment Notes

## Current deployment model

The service now uses two application-level security chains:

- `/api/grafana/**` for Grafana mTLS application authentication
- `/api/**`, `/oauth2/**`, and `/login/oauth2/**` for browser user authentication through PingFederate

Grafana authentication resolves the x509 certificate subject `CN` and matches it against `panel.security.application-clients`.

## Important mTLS constraint

TLS client-certificate negotiation happens before the request path is known.

That means a single HTTPS listener cannot do transport-level mTLS only for `/api/grafana/**`. The current implementation uses:

- `server.ssl.client-auth=want`
- application-layer enforcement that `/api/grafana/**` must resolve to a trusted certificate-backed principal

This keeps browser user traffic working without a client certificate while still requiring x509 authentication for Grafana endpoints.

## Recommended production posture

- Keep Grafana traffic on a dedicated hostname or ingress route when possible.
- Configure the Spring Boot trust store so only trusted client certificates are accepted.
- Keep `panel.security.application-clients[*].certificate-cn` scoped to the smallest allowed set.
- Forward the public frontend origin (`X-Forwarded-Host`, `X-Forwarded-Port`, `X-Forwarded-Proto`) to Spring Boot and enable forwarded-header processing so `{baseUrl}` resolves to the browser-facing callback origin.
- Use `server.servlet.session.cookie.same-site=lax`, `http-only=true`, and `secure=true` in production so the OIDC authorization-code callback can bring the session cookie back.
- When the backend has multiple replicas, use sticky sessions or a shared session store; otherwise the authorization request can be created on one pod and the callback can land on another, which also surfaces as `authorization_request_not_found`.

For step-by-step validation of the browser login flow, see `panel/docs/security/oidc-verification.md`.

## When to move to a dedicated listener

Move Grafana traffic to a dedicated listener, port, or ingress when any of these become true:

- browser clients are prompted for certificates unexpectedly
- the reverse proxy cannot preserve the current shared-listener behavior safely
- security policy requires transport-level mTLS enforcement instead of application-layer enforcement

At that point, set the dedicated Grafana entrypoint to require client certificates at the transport layer and keep the browser-facing listener certificate-optional or certificate-free.
