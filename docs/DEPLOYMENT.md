# Deployment

This repo has a reusable EC2 deploy script for the backend:

```bash
deploy/aws/deploy-backend.sh
```

The script syncs the backend code to the EC2 instance, rebuilds the Docker image, restarts the backend container, and waits for `/health` to come back.

## Common Commands

Run a full deploy with backend tests first:

```bash
make backend-deploy
```

Run a faster deploy without tests:

```bash
make backend-deploy-fast
```

Deploy and seed demo data:

```bash
make backend-deploy-seed
```

Deploy and reset demo data:

```bash
make backend-deploy-reset
```

## Direct Script Options

```bash
deploy/aws/deploy-backend.sh --skip-tests
deploy/aws/deploy-backend.sh --seed
deploy/aws/deploy-backend.sh --reset-seed
deploy/aws/deploy-backend.sh --help
```

## Defaults

The script currently targets:

```bash
EC2_HOST=65.0.101.246
EC2_USER=ubuntu
SSH_KEY=$HOME/.ssh/inspection-copilot-key.pem
REMOTE_DIR=/home/ubuntu/inspection-copilot
HEALTH_URL=http://65.0.101.246/health
```

Override any of these when needed:

```bash
EC2_HOST=1.2.3.4 make backend-deploy-fast
```

## Important Notes

- Local `.env` files are not synced to EC2.
- The server keeps its private runtime config in `deploy/.env.aws` on EC2.
- The backend uses local SQLite in development by default.
- The deployed backend uses DynamoDB and S3 when `JOCKEY_COPILOT_STORAGE_BACKEND=dynamodb` is set in the EC2 env file.
- Docker dependency layers are cached unless `backend/pyproject.toml`, `backend/uv.lock`, the Dockerfile, or the Docker cache changes.
- Backend code-only changes reuse the dependency layer because `backend/Dockerfile` copies `pyproject.toml` and `uv.lock` before copying `app/`.
- The voice agent uses Small WebRTC. The EC2 security group must allow inbound UDP media traffic, `/start` returns ICE servers for client NAT traversal, and the EC2 container runs with host networking so dynamic WebRTC UDP sockets are reachable.
