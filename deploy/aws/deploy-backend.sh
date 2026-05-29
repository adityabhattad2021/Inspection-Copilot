#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

EC2_HOST="${EC2_HOST:-65.0.101.246}"
EC2_USER="${EC2_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/cars24-jockey-hack-key.pem}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/cars24-jockey}"
HEALTH_URL="${HEALTH_URL:-http://$EC2_HOST/health}"

RUN_TESTS=1
SEED_COMMAND=""

usage() {
  cat <<EOF
Usage: deploy/aws/deploy-backend.sh [options]

Deploy backend code to the EC2 instance and restart the Docker service.

Options:
  --skip-tests       Do not run make backend-test before deploying
  --seed             Run python -m app.seed seed after restart
  --reset-seed       Run python -m app.seed reset after restart
  -h, --help         Show this help

Environment overrides:
  EC2_HOST           Default: $EC2_HOST
  EC2_USER           Default: $EC2_USER
  SSH_KEY            Default: $SSH_KEY
  REMOTE_DIR         Default: $REMOTE_DIR
  HEALTH_URL         Default: $HEALTH_URL
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-tests)
      RUN_TESTS=0
      shift
      ;;
    --seed)
      SEED_COMMAND="seed"
      shift
      ;;
    --reset-seed)
      SEED_COMMAND="reset"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ ! -f "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

cd "$ROOT_DIR"

if [[ "$RUN_TESTS" == "1" ]]; then
  echo "==> Running backend tests"
  make backend-test
fi

echo "==> Syncing backend and deploy files to $EC2_USER@$EC2_HOST"
rsync -az \
  -e "ssh -i $SSH_KEY" \
  --exclude ".git" \
  --exclude ".env" \
  --exclude ".env.*" \
  --exclude ".venv" \
  --exclude ".local" \
  --exclude ".pytest_cache" \
  --exclude ".ruff_cache" \
  --exclude ".uv-cache" \
  --exclude "__pycache__" \
  --exclude "*.pyc" \
  --exclude "*.pyo" \
  --exclude "*.pkg" \
  --exclude "AWSCLIV2.pkg" \
  backend deploy "$EC2_USER@$EC2_HOST:$REMOTE_DIR/"

echo "==> Rebuilding and restarting backend on EC2"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
  set -euo pipefail
  cd '$REMOTE_DIR/deploy'
  test -f .env.aws || {
    echo 'Missing $REMOTE_DIR/deploy/.env.aws on EC2' >&2
    exit 1
  }
  docker-compose build backend
  docker-compose rm -sf backend
  docker-compose up -d backend
"

if [[ -n "$SEED_COMMAND" ]]; then
  echo "==> Running app.seed $SEED_COMMAND on EC2"
  ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
    set -euo pipefail
    cd '$REMOTE_DIR/deploy'
    docker-compose exec -T backend uv run python -m app.seed '$SEED_COMMAND'
  "
fi

echo "==> Checking backend health: $HEALTH_URL"
for attempt in $(seq 1 20); do
  if curl -fs "$HEALTH_URL" >/dev/null 2>&1; then
    break
  fi

  if [[ "$attempt" == "20" ]]; then
    echo "Backend health check failed after $attempt attempts" >&2
    ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
      cd '$REMOTE_DIR/deploy'
      docker-compose ps
      docker-compose logs --tail=80 backend
    " >&2
    exit 1
  fi

  echo "Backend not ready yet; retrying health check ($attempt/20)"
  sleep 2
done

echo "==> Backend deploy complete"
echo "URL: ${HEALTH_URL%/health}"
