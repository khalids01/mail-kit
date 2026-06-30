#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DOMAIN="${DOMAIN:-}"
MAIL_HOST="${MAIL_HOST:-}"
APP_HOST="${APP_HOST:-}"
API_HOST="${API_HOST:-}"
VPS_IP="${VPS_IP:-}"
DKIM_SELECTOR="${DKIM_SELECTOR:-dkim}"
MAILKIT_ENV="${MAILKIT_ENV:-$ROOT_DIR/apps/server/.env.production}"
MAILU_ENV="${MAILU_ENV:-$ROOT_DIR/deploy/mailu.env}"
MAILU_COMPOSE="${MAILU_COMPOSE:-}"
MAILKIT_COMPOSE="${MAILKIT_COMPOSE:-$ROOT_DIR/docker-compose.production.yml}"
MAILU_API_URL="${MAILU_API_URL:-}"
MAILU_API_TOKEN="${MAILU_API_TOKEN:-}"

pass_count=0
warn_count=0
fail_count=0

print_header() {
  printf "\n== %s ==\n" "$1"
}

pass() {
  pass_count=$((pass_count + 1))
  printf "[OK]   %s\n" "$1"
}

warn() {
  warn_count=$((warn_count + 1))
  printf "[WARN] %s\n" "$1"
}

fail() {
  fail_count=$((fail_count + 1))
  printf "[MISS] %s\n" "$1"
}

info() {
  printf "[INFO] %s\n" "$1"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

read_env_value() {
  local file="$1"
  local key="$2"

  if [ ! -f "$file" ]; then
    return 1
  fi

  awk -F= -v key="$key" '
    $0 !~ /^[[:space:]]*#/ && $1 == key {
      value = substr($0, index($0, "=") + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      gsub(/^"|"$/, "", value)
      gsub(/^'\''|'\''$/, "", value)
      print value
      exit
    }
  ' "$file"
}

config_value() {
  local file="$1"
  local key="$2"
  local value=""

  value="$(printenv "$key" 2>/dev/null || true)"
  if [ -n "$value" ]; then
    printf "%s" "$value"
    return 0
  fi

  read_env_value "$file" "$key" || true
}

mask_secret() {
  local value="$1"
  if [ -z "$value" ]; then
    printf "missing"
  else
    printf "set (%s chars)" "${#value}"
  fi
}

resolve_from_env() {
  local key="$1"
  local fallback="$2"
  local value="$fallback"

  if [ -z "$value" ]; then
    value="$(printenv "$key" 2>/dev/null || true)"
  fi

  if [ -z "$value" ] && [ -f "$MAILKIT_ENV" ]; then
    value="$(read_env_value "$MAILKIT_ENV" "$key" || true)"
  fi

  if [ -z "$value" ] && [ -f "$MAILU_ENV" ]; then
    value="$(read_env_value "$MAILU_ENV" "$key" || true)"
  fi

  printf "%s" "$value"
}

dns_short() {
  local type="$1"
  local name="$2"

  if command_exists dig; then
    dig +short "$type" "$name" 2>/dev/null
    return
  fi

  if command_exists nslookup; then
    nslookup -type="$type" "$name" 2>/dev/null
    return
  fi

  return 1
}

probe_tcp() {
  local host="$1"
  local port="$2"

  if command_exists nc; then
    timeout 5 nc -z "$host" "$port" >/dev/null 2>&1
    return $?
  fi

  timeout 5 bash -c "cat < /dev/null > /dev/tcp/$host/$port" >/dev/null 2>&1
}

print_header "Mail Kit + Mailu VPS Readiness"
info "Run from the VPS for the most useful result."
info "Usage example:"
info "DOMAIN=example.com MAIL_HOST=mail.example.com VPS_IP=1.2.3.4 DKIM_SELECTOR=dkim ./scripts/check-vps-mailu.sh"

DOMAIN="$(resolve_from_env DOMAIN "$DOMAIN")"
MAIL_HOST="$(resolve_from_env MAIL_HOST "$MAIL_HOST")"
APP_HOST="$(resolve_from_env APP_HOST "$APP_HOST")"
API_HOST="$(resolve_from_env API_HOST "$API_HOST")"
MAILU_API_URL="$(resolve_from_env MAIL_ENGINE_API_URL "$MAILU_API_URL")"
MAILU_API_TOKEN="$(resolve_from_env MAIL_ENGINE_API_TOKEN "$MAILU_API_TOKEN")"

if [ -z "$APP_HOST" ]; then
  APP_HOST="$(resolve_from_env APP_DOMAIN "$APP_HOST")"
fi

if [ -z "$API_HOST" ]; then
  API_HOST="$(resolve_from_env API_DOMAIN "$API_HOST")"
fi

if [ -z "$MAIL_HOST" ] && [ -n "$DOMAIN" ]; then
  MAIL_HOST="mail.$DOMAIN"
fi

if [ -z "$APP_HOST" ] && [ -n "$DOMAIN" ]; then
  APP_HOST="app.$DOMAIN"
fi

if [ -z "$API_HOST" ] && [ -n "$DOMAIN" ]; then
  API_HOST="api.$DOMAIN"
fi

if [ -z "$VPS_IP" ] && command_exists curl; then
  VPS_IP="$(curl -fsS --max-time 4 https://api.ipify.org 2>/dev/null || true)"
fi

print_header "Inputs"
[ -n "$DOMAIN" ] && pass "DOMAIN=$DOMAIN" || fail "DOMAIN is not set"
[ -n "$MAIL_HOST" ] && pass "MAIL_HOST=$MAIL_HOST" || fail "MAIL_HOST is not set"
[ -n "$APP_HOST" ] && info "APP_HOST=$APP_HOST" || warn "APP_HOST is not set"
[ -n "$API_HOST" ] && info "API_HOST=$API_HOST" || warn "API_HOST is not set"
[ -n "$VPS_IP" ] && info "VPS_IP=$VPS_IP" || warn "VPS_IP not set and public IP auto-detect failed"
info "DKIM_SELECTOR=$DKIM_SELECTOR"
info "MAILKIT_ENV=$MAILKIT_ENV"
info "MAILU_ENV=$MAILU_ENV"

print_header "Required Tools"
for tool in docker curl dig nc ss awk; do
  if command_exists "$tool"; then
    pass "$tool is available"
  else
    warn "$tool is missing"
  fi
done

print_header "Mail Kit Env"
if [ -f "$MAILKIT_ENV" ]; then
  pass "Found Mail Kit env file"
else
  fail "Mail Kit env file not found: $MAILKIT_ENV"
fi

for key in MAIL_ENGINE_MODE MAIL_ENGINE_API_URL MAIL_ENGINE_API_TOKEN SMTP_HOST SMTP_PORT MAIL_ENGINE_IMAP_HOST MAIL_ENGINE_IMAP_PORT MAILBOX_SECRET_KEY; do
  value="$(config_value "$MAILKIT_ENV" "$key")"
  case "$key" in
    MAIL_ENGINE_API_TOKEN|MAILBOX_SECRET_KEY)
      [ -n "$value" ] && pass "$key=$(mask_secret "$value")" || fail "$key is missing"
      ;;
    MAIL_ENGINE_MODE)
      [ "$value" = "mailu" ] && pass "$key=mailu" || fail "$key should be mailu, current: ${value:-missing}"
      ;;
    *)
      [ -n "$value" ] && pass "$key=$value" || fail "$key is missing"
      ;;
  esac
done

print_header "Mailu Env"
if [ -f "$MAILU_ENV" ]; then
  pass "Found Mailu env file"
else
  warn "Mailu env file not found: $MAILU_ENV"
fi

mailu_api_enabled="$(config_value "$MAILU_ENV" API)"
mailu_web_api="$(config_value "$MAILU_ENV" WEB_API)"
mailu_api_token="$(config_value "$MAILU_ENV" API_TOKEN)"

[ "$mailu_api_enabled" = "true" ] && pass "Mailu API=true" || warn "Mailu API is not confirmed enabled in $MAILU_ENV"
[ "$mailu_web_api" = "/api" ] && pass "Mailu WEB_API=/api" || warn "Mailu WEB_API should usually be /api, current: ${mailu_web_api:-missing}"
[ -n "$mailu_api_token" ] && pass "Mailu API_TOKEN=$(mask_secret "$mailu_api_token")" || warn "Mailu API_TOKEN missing in $MAILU_ENV"

print_header "Docker Services"
if command_exists docker; then
  if docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -Ei 'mailu|front|smtp|imap|admin|redis|postgres|server|web' >/tmp/mail-kit-vps-docker.txt; then
    pass "Relevant Docker services found"
    sed 's/^/[INFO] /' /tmp/mail-kit-vps-docker.txt
  else
    warn "No obvious Mailu/Mail Kit containers found in docker ps"
  fi

  if [ -f "$MAILKIT_COMPOSE" ]; then
    pass "Mail Kit compose file exists: $MAILKIT_COMPOSE"
  else
    warn "Mail Kit compose file not found: $MAILKIT_COMPOSE"
  fi

  if [ -n "$MAILU_COMPOSE" ]; then
    [ -f "$MAILU_COMPOSE" ] && pass "Mailu compose file exists: $MAILU_COMPOSE" || warn "Mailu compose file not found: $MAILU_COMPOSE"
  else
    info "MAILU_COMPOSE not set; skipping Mailu compose file check"
  fi
else
  warn "docker command unavailable; cannot inspect containers"
fi

print_header "Ports"
for port in 25 465 587 993 80 443; do
  if command_exists ss && ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$port$"; then
    pass "Local listener found on TCP $port"
  else
    warn "No local listener detected on TCP $port"
  fi

  if [ -n "$MAIL_HOST" ]; then
    if probe_tcp "$MAIL_HOST" "$port"; then
      pass "$MAIL_HOST:$port accepts TCP"
    else
      warn "$MAIL_HOST:$port did not accept TCP from here. External firewall/provider checks may still be needed."
    fi
  fi
done

print_header "DNS"
if ! command_exists dig && ! command_exists nslookup; then
  warn "dig/nslookup missing; install dnsutils/bind-tools to check DNS automatically"
else
  if [ -n "$APP_HOST" ]; then
    app_a="$(dns_short A "$APP_HOST" | tr '\n' ' ')"
    [ -n "$app_a" ] && pass "A $APP_HOST -> $app_a" || warn "A $APP_HOST not found"
  fi

  if [ -n "$API_HOST" ]; then
    api_a="$(dns_short A "$API_HOST" | tr '\n' ' ')"
    [ -n "$api_a" ] && pass "A $API_HOST -> $api_a" || warn "A $API_HOST not found"
  fi

  if [ -n "$MAIL_HOST" ]; then
    mail_a="$(dns_short A "$MAIL_HOST" | tr '\n' ' ')"
    [ -n "$mail_a" ] && pass "A $MAIL_HOST -> $mail_a" || fail "A $MAIL_HOST not found"
  fi

  if [ -n "$DOMAIN" ]; then
    mx="$(dns_short MX "$DOMAIN" | tr '\n' ' ')"
    if printf "%s" "$mx" | grep -F "$MAIL_HOST" >/dev/null 2>&1; then
      pass "MX $DOMAIN points to $MAIL_HOST"
    else
      fail "MX $DOMAIN does not appear to point to $MAIL_HOST. Current: ${mx:-missing}"
    fi

    spf="$(dns_short TXT "$DOMAIN" | tr '\n' ' ')"
    if printf "%s" "$spf" | grep -i 'v=spf1' >/dev/null 2>&1; then
      pass "SPF TXT found on $DOMAIN: $spf"
    else
      fail "SPF TXT missing on $DOMAIN"
    fi

    dmarc="$(dns_short TXT "_dmarc.$DOMAIN" | tr '\n' ' ')"
    if printf "%s" "$dmarc" | grep -i 'v=DMARC1' >/dev/null 2>&1; then
      pass "DMARC TXT found on _dmarc.$DOMAIN: $dmarc"
    else
      fail "DMARC TXT missing on _dmarc.$DOMAIN"
    fi

    dkim_name="$DKIM_SELECTOR._domainkey.$DOMAIN"
    dkim="$(dns_short TXT "$dkim_name" | tr '\n' ' ')"
    if printf "%s" "$dkim" | grep -i 'v=DKIM1' >/dev/null 2>&1; then
      pass "DKIM TXT found on $dkim_name"
    else
      warn "DKIM TXT not found on $dkim_name. Check the selector generated by Mailu."
    fi
  fi
fi

print_header "PTR / Reverse DNS"
if [ -n "$VPS_IP" ] && command_exists dig; then
  ptr="$(dig +short -x "$VPS_IP" 2>/dev/null | sed 's/\.$//' | tr '\n' ' ')"
  if [ -n "$ptr" ]; then
    pass "PTR $VPS_IP -> $ptr"
    if [ -n "$MAIL_HOST" ] && printf "%s" "$ptr" | grep -F "$MAIL_HOST" >/dev/null 2>&1; then
      pass "PTR matches MAIL_HOST"
    else
      warn "PTR should usually be $MAIL_HOST for best deliverability"
    fi
  else
    fail "No PTR found for $VPS_IP. Set reverse DNS in your VPS provider panel."
  fi
else
  warn "PTR check skipped. Run: dig +short -x YOUR_VPS_IP"
fi

print_header "Mailu API"
if [ -n "$MAILU_API_URL" ] && [ -n "$MAILU_API_TOKEN" ] && command_exists curl; then
  api_base="${MAILU_API_URL%/}"
  if [ "${api_base%/v1}" = "$api_base" ]; then
    api_base="$api_base/v1"
  fi

  code="$(curl -k -sS -o /tmp/mailu-api-check.txt -w "%{http_code}" \
    -H "Authorization: Bearer $MAILU_API_TOKEN" \
    --max-time 8 "$api_base/swagger.json" 2>/dev/null || true)"

  case "$code" in
    200)
      pass "Mailu API swagger reachable at $api_base/swagger.json"
      ;;
    401|403)
      fail "Mailu API reachable but token was rejected with HTTP $code"
      ;;
    000|"")
      warn "Mailu API did not respond at $api_base/swagger.json"
      ;;
    *)
      warn "Mailu API returned HTTP $code at $api_base/swagger.json"
      ;;
  esac
else
  warn "Mailu API check skipped. Need MAIL_ENGINE_API_URL, MAIL_ENGINE_API_TOKEN, and curl."
fi

print_header "SPF / DKIM / DMARC Delivery Headers"
warn "Cannot fully verify Gmail/Outlook header pass without sending a real message."
info "Send a test email from Mail Kit to Gmail, open the message, choose 'Show original', then check:"
info "  SPF: PASS with your domain"
info "  DKIM: PASS with your domain"
info "  DMARC: PASS with your domain"
info "You can also send to a tester like mail-tester.com for a quick deliverability report."

print_header "Summary"
printf "[INFO] OK=%s WARN=%s MISSING=%s\n" "$pass_count" "$warn_count" "$fail_count"

if [ "$fail_count" -gt 0 ]; then
  exit 1
fi

exit 0
