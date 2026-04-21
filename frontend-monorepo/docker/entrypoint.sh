#!/bin/sh
set -eu

validate_origin() {
  value="$1"
  name="$2"

  case "$value" in
    http://*|https://*) ;;
    *)
      echo >&2 "$name must start with http:// or https://"
      exit 1
      ;;
  esac

  case "$value" in
    *" "*|*";"*|*"{"*|*"}"*)
      echo >&2 "$name contains characters that would break nginx config."
      exit 1
      ;;
  esac
}

validate_public_origin() {
  value="$1"
  name="$2"

  case "$value" in
    http://*|https://*)
      echo >&2 "$name must not include http:// or https://"
      exit 1
      ;;
  esac

  case "$value" in
    *"/"*|*" "*|*";"*|*"{"*|*"}"*)
      echo >&2 "$name must be host or host:port without a path and without nginx-breaking characters."
      exit 1
      ;;
  esac

  case "$value" in
    *:*)
      host="${value%:*}"
      port="${value##*:}"
      if [ -z "$host" ] || [ -z "$port" ]; then
        echo >&2 "$name must be host or host:port"
        exit 1
      fi

      case "$port" in
        *[!0-9]*)
          echo >&2 "$name port must be numeric"
          exit 1
          ;;
      esac
      ;;
    "")
      echo >&2 "$name must not be empty"
      exit 1
      ;;
  esac
}

validate_scheme() {
  case "$1" in
    http|https) ;;
    *)
      echo >&2 "PUBLIC_SCHEME must be http or https"
      exit 1
      ;;
  esac
}

parse_public_origin() {
  origin="$1"
  scheme="$2"

  case "$origin" in
    *:*)
      host="${origin%:*}"
      port="${origin##*:}"
      ;;
    *)
      host="$origin"
      if [ "$scheme" = "https" ]; then
        port=443
      else
        port=80
      fi
      ;;
  esac

  printf '%s\n%s\n' "$host" "$port"
}

if [ "$#" -eq 0 ] || [ "$1" = "nginx" ]; then
  : "${BACKEND_ORIGIN:?BACKEND_ORIGIN must be set, e.g. https://api.example.com}"
  : "${PUBLIC_ORIGIN:?PUBLIC_ORIGIN must be set, e.g. app.example.com or localhost:8080}"

  PUBLIC_ORIGIN="${PUBLIC_ORIGIN%/}"
  BACKEND_ORIGIN="${BACKEND_ORIGIN%/}"
  PUBLIC_SCHEME="${PUBLIC_SCHEME:-https}"

  export PUBLIC_ORIGIN
  export BACKEND_ORIGIN
  export PUBLIC_SCHEME

  validate_origin "$BACKEND_ORIGIN" "BACKEND_ORIGIN"
  validate_public_origin "$PUBLIC_ORIGIN" "PUBLIC_ORIGIN"
  validate_scheme "$PUBLIC_SCHEME"

  ORIGIN_PARTS="$(parse_public_origin "$PUBLIC_ORIGIN" "$PUBLIC_SCHEME")"
  PUBLIC_HOST="$(printf '%s\n' "$ORIGIN_PARTS" | sed -n '1p')"
  PUBLIC_PORT="$(printf '%s\n' "$ORIGIN_PARTS" | sed -n '2p')"
  export PUBLIC_HOST
  export PUBLIC_PORT

  mkdir -p \
    /tmp/nginx/conf.d \
    /tmp/nginx-client-body \
    /tmp/nginx-proxy \
    /tmp/nginx-fastcgi \
    /tmp/nginx-uwsgi \
    /tmp/nginx-scgi

  cat > /tmp/nginx/conf.d/default.conf <<EOF
server {
  listen 8080;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files \$uri \$uri/ /index.html;
  }

  location = /api {
    return 301 /api/;
  }

  location /api/ {
    proxy_pass $BACKEND_ORIGIN;
    proxy_http_version 1.1;
    proxy_set_header Host \$proxy_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $PUBLIC_HOST;
    proxy_set_header X-Forwarded-Port $PUBLIC_PORT;
    proxy_set_header X-Forwarded-Proto $PUBLIC_SCHEME;
  }

  location = /oauth2 {
    return 301 /oauth2/;
  }

  location /oauth2/ {
    proxy_pass $BACKEND_ORIGIN;
    proxy_http_version 1.1;
    proxy_set_header Host \$proxy_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $PUBLIC_HOST;
    proxy_set_header X-Forwarded-Port $PUBLIC_PORT;
    proxy_set_header X-Forwarded-Proto $PUBLIC_SCHEME;
  }

  location = /oauth {
    return 301 /oauth/;
  }

  location /oauth/ {
    proxy_pass $BACKEND_ORIGIN;
    proxy_http_version 1.1;
    proxy_set_header Host \$proxy_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $PUBLIC_HOST;
    proxy_set_header X-Forwarded-Port $PUBLIC_PORT;
    proxy_set_header X-Forwarded-Proto $PUBLIC_SCHEME;
  }

  location = /login/oauth2 {
    return 301 /login/oauth2/;
  }

  location /login/oauth2/ {
    proxy_pass $BACKEND_ORIGIN;
    proxy_http_version 1.1;
    proxy_set_header Host \$proxy_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $PUBLIC_HOST;
    proxy_set_header X-Forwarded-Port $PUBLIC_PORT;
    proxy_set_header X-Forwarded-Proto $PUBLIC_SCHEME;
  }
}
EOF

  echo "Rendered Nginx runtime config under /tmp."
  if ! nginx -t -c /etc/nginx/nginx.conf; then
    echo >&2 "--- nginx debug ---"
    id >&2
    echo >&2 "--- /etc/nginx/nginx.conf ---"
    sed -n '1,200p' /etc/nginx/nginx.conf >&2
    echo >&2 "--- /tmp/nginx/conf.d/default.conf ---"
    sed -n '1,200p' /tmp/nginx/conf.d/default.conf >&2
    exit 1
  fi
fi

exec "$@"
