# MultiModuleApp

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.21.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Docker deployment

This repository includes a production `Dockerfile` for `multi-module-app`.

### Build the image

```bash
DOCKER_BUILDKIT=1 docker build \
  --secret id=npmrc,src=$HOME/.npmrc \
  -t multi-module-app .
```

If `npm ci` needs private Artifactory credentials, provide them through a local `.npmrc` file mounted as a BuildKit secret. Do not copy credentials into the image or commit `.npmrc` to the repository.

Example `$HOME/.npmrc`:

```ini
registry=https://your-artifactory.example.com/artifactory/api/npm/npm/
always-auth=true
//your-artifactory.example.com/artifactory/api/npm/npm/:username=YOUR_USERNAME
; add your own local _password entry here (base64-encoded) without committing it
//your-artifactory.example.com/artifactory/api/npm/npm/:email=YOUR_EMAIL
```

### Run the container

The container serves the Angular SPA with Nginx and proxies `/api/*` requests to a backend hosted on a different domain.

```bash
docker run --rm -p 8080:8080 \
  -e PUBLIC_ORIGIN=localhost:8080 \
  -e PUBLIC_SCHEME=http \
  -e BACKEND_ORIGIN=https://api.example.com \
  multi-module-app
```

The container now runs as the non-root `nginx` user, listens on port `8080`, and writes its generated Nginx config under `/tmp`, which is compatible with common Kubernetes restricted security contexts.

### Supported environment variables

- `PUBLIC_ORIGIN`: public frontend host with optional port, for example `app.example.com` or `localhost:8080`. Do not include `http://` or `https://`.
- `PUBLIC_SCHEME` (optional): public frontend scheme used for `X-Forwarded-Proto`. Defaults to `https`.
- `BACKEND_ORIGIN`: backend origin that receives proxied `/api/*` requests.
- The nginx container also forwards `PUBLIC_ORIGIN` and `PUBLIC_SCHEME` to the backend as `X-Forwarded-*` headers so Spring Security can generate `/login/oauth2/code/*` callbacks on the public frontend origin instead of the internal backend host.
- Frontend auth paths are served from the built asset at `projects/multi-module-app/public/auth-config.json`, not from container environment variables.

If the backend runs with more than one replica in Kubernetes, the login-start request and the `/login/oauth2/code/*` callback must resolve to the same HTTP session. Use sticky sessions at the ingress/service layer or back the session with a shared store such as Spring Session.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
