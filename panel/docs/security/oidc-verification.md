# OIDC Verification Guide

Use this guide to verify the backend-managed OIDC flow from the frontend entrypoint through the Spring Security callback handler.

This is mainly useful when troubleshooting:

- `authorization_request_not_found`
- wrong `redirect_uri`
- callback host or scheme mismatches
- session cookie issues around the IdP redirect

## Scope

The application uses these browser-facing entrypoints:

- `/api/auth/login`
- `/oauth2/authorization/{registrationId}`
- `/login/oauth2/code/{registrationId}`

The backend stores the authorization request in the HTTP session. The callback must come back with:

- the same browser session cookie
- the same `state`
- the correct public callback origin

If any of those are wrong, Spring Security can fail the callback with `authorization_request_not_found`.

## Before You Start

Pick the frontend origin you actually open in the browser:

- Angular dev server with proxy: `http://localhost:4200`
- Frontend nginx container: `http://localhost:8080`

Examples below use:

```bash
BASE=http://localhost:4200
COOKIE=/tmp/oidc.cookies
```

If the frontend and backend each run as a single pod, you do not need sticky sessions for this verification. Origin and cookie issues can still break the flow even with only one pod.

## Step 1: Run The Backend Security Test

Run the targeted backend test first:

```bash
cd /home/kratos/projects/data-source/panel
bash ./gradlew test --tests com.data.service.core.security.SecurityIntegrationTest
```

Expected:

- the test passes
- the generated OAuth authorization redirect uses the public frontend callback origin

## Step 2: Start The Login Flow And Capture The Session Cookie

```bash
rm -f "$COOKIE" /tmp/h1 /tmp/h2 /tmp/h3

curl -sS -D /tmp/h1 -o /dev/null -c "$COOKIE" \
  "$BASE/api/auth/login?returnUrl=%2Fworkspace"

echo "== step1 =="
tr -d '\r' < /tmp/h1 | egrep -i '^(location|set-cookie):'
```

Expected:

- `Location: /oauth2/authorization/pingfed`
- `Set-Cookie: JSESSIONID=...`

Cookie expectations:

- `SameSite=Lax` is the normal choice for a browser OIDC redirect flow
- `SameSite=None; Secure` is more permissive and only needed when you truly need cross-site cookie sending
- `SameSite=Strict` is a common cause of the callback losing the session

## Step 3: Inspect The Authorization Redirect Sent To The IdP

```bash
curl -sS -D /tmp/h2 -o /dev/null -b "$COOKIE" -c "$COOKIE" \
  "$BASE/oauth2/authorization/pingfed"

echo "== step2 =="
tr -d '\r' < /tmp/h2 | grep -i '^Location:'

STATE=$(tr -d '\r' < /tmp/h2 | sed -n 's/^Location: .*[\?&]state=\([^&]*\).*/\1/p')
echo "STATE=$STATE"
```

Expected:

- the response redirects to PingFederate
- the `Location` contains a non-empty `state`
- the `redirect_uri` points to the public frontend callback origin

Example:

```text
redirect_uri=https://app.example.com/login/oauth2/code/pingfed
```

If `redirect_uri` points at the wrong host, scheme, or port, fix that before checking anything else.

## Step 4: Reuse The Real State On The Callback Path

Do not use `state=fake`. That only proves the failure handler is wired.

Use the real `state` from step 3:

```bash
curl -sS -D /tmp/h3 -o /dev/null -b "$COOKIE" -c "$COOKIE" \
  "$BASE/login/oauth2/code/pingfed?code=fake&state=$STATE"

echo "== step3 =="
tr -d '\r' < /tmp/h3 | egrep -i '^(location|set-cookie):'
```

Expected:

- the request reaches the backend callback handler
- the response is still typically a `302` because the fake `code` should fail later
- the failure should no longer be `authorization_request_not_found`

Interpretation:

- `authorization_request_not_found`
  The callback did not recover the saved authorization request. Check cookie return, callback origin, or session continuity.
- different auth failure after the fake code
  The session and `state` were recovered correctly. The remaining failure is expected because the code is fake.

## Step 5: Verify The Real Browser Flow In DevTools

`curl` does not enforce browser `SameSite` rules, so you must also check the browser directly.

In the browser:

1. Open DevTools.
2. Open the `Network` tab.
3. Enable `Preserve log`.
4. Click sign in.
5. Inspect these requests:
   - `/api/auth/login`
   - `/oauth2/authorization/pingfed`
   - `/login/oauth2/code/pingfed?...`

Confirm:

- `/api/auth/login` sets `JSESSIONID`
- the cookie attributes are what you expect
- the authorization redirect uses the public callback origin
- the callback request includes `Cookie: JSESSIONID=...`

If the callback request does not include `JSESSIONID`, the common causes are:

- `SameSite=Strict`
- `SameSite=None` without `Secure`
- callback host or scheme mismatch
- cookie domain or path mismatch

## Quick Diagnosis Matrix

- `redirect_uri` is wrong
  Fix proxy forwarding or frontend public-origin configuration.
- callback request has no `JSESSIONID`
  Fix cookie policy or origin mismatch.
- callback request has `JSESSIONID`, but still shows `authorization_request_not_found`
  Check whether the session was recreated, the app restarted, or the request hit a different backend replica.
- callback path returns a frontend 404
  Fix frontend proxy routing for `/login/oauth2/**`.

## Related Files

- `frontend-monorepo/docker/entrypoint.sh`
- `frontend-monorepo/docker/nginx.conf.template`
- `panel/src/main/java/com/data/service/core/security/SecurityConfiguration.java`
- `panel/src/main/resources/application.properties`
- `panel/src/test/java/com/data/service/core/security/SecurityIntegrationTest.java`
