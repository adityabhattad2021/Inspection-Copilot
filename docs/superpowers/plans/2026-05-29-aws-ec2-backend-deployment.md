# AWS EC2 Backend Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Cars24 Jockey Copilot backend on AWS using EC2 for FastAPI, DynamoDB for inspection state, and S3 for images/audio/reports.

**Architecture:** Run FastAPI on an Ubuntu EC2 instance behind Caddy or Nginx. The backend uses an EC2 IAM role to access DynamoDB and S3 without stored AWS access keys. Mobile talks to the backend over HTTPS; media uploads use S3 presigned URLs.

**Tech Stack:** AWS CLI, EC2, IAM, Security Groups, DynamoDB, S3, SSM Parameter Store or Secrets Manager, Docker, Docker Compose, Caddy/Nginx, FastAPI, Uvicorn, boto3.

---

## Can This Be Done Fully Using CLI?

Yes, the deployment can be done fully using CLI for AWS resources and server setup.

The only things that are not purely automatable without user input are:

- AWS account authentication, MFA, and selecting the AWS profile.
- Optional domain DNS ownership if the domain is outside Route 53.
- Creating or providing the OpenAI API key value.

Everything else can be done with:

```bash
aws ...
ssh ...
scp ...
docker compose ...
curl ...
```

## Deployment Defaults

Use these values unless the user overrides them:

```bash
export AWS_PROFILE=default
export AWS_REGION=ap-south-1
export APP_NAME=cars24-jockey
export ENV_NAME=hack
export KEY_NAME=cars24-jockey-hack-key
export EC2_INSTANCE_TYPE=t3.small
export DDB_TABLE=cars24-jockey-hack
export S3_BUCKET=cars24-jockey-hack-evidence-$(aws sts get-caller-identity --query Account --output text)
export SERVER_PORT=8000
```

If realtime voice/WebRTC is part of the demo, EC2 is preferred over Lambda because it can keep the FastAPI process and voice runtime alive normally.

---

## File Structure For Implementation

**Infrastructure and deployment files**

- Create: `backend/Dockerfile`
- Create: `deploy/docker-compose.yml`
- Create: `deploy/Caddyfile`
- Create: `deploy/ec2-user-data.sh`
- Create: `deploy/aws/create-resources.sh`
- Create: `deploy/aws/deploy-to-ec2.sh`
- Create: `deploy/aws/check-deployment.sh`

**Backend runtime changes**

- Modify: `backend/pyproject.toml`
  - Add `boto3`.
- Modify: `backend/requirements.txt`
  - Keep compatible with Docker install path if this project continues using requirements in container builds.
- Create: `backend/app/config.py`
  - Centralize environment variables for storage mode, DynamoDB table, S3 bucket, AWS region, and public backend URL.
- Create: `backend/app/storage/dynamodb_store.py`
  - DynamoDB-backed session, step, evidence, observation, AI intervention, profile, and report persistence.
- Create: `backend/app/storage/s3_store.py`
  - S3 object key helpers, presigned upload URLs, presigned report URLs, and report object writes.
- Modify: `backend/app/database/__init__.py`
  - Route existing database function imports to either SQLite or DynamoDB based on `JOCKEY_COPILOT_STORAGE_BACKEND`.
- Modify: `backend/app/routes/evidence.py`
  - Stop writing uploaded images to `.local/evidence` in AWS mode. Prefer presigned uploads and store S3 keys.
- Create or modify: `backend/app/routes/uploads.py`
  - Add `POST /uploads/presign` for direct mobile-to-S3 uploads.
- Modify: `backend/app/main.py`
  - Include `uploads_router`.
- Modify: `backend/app/routes/sessions.py`
  - On complete, return report metadata once S3 report generation exists.

**Tests**

- Create: `backend/tests/test_aws_storage_contracts.py`
  - Tests object key generation, DynamoDB item key shape, and presign response shape with mocked boto3 clients.
- Modify: existing backend tests only if import paths need to support storage backend selection.

---

## Phase 1: Confirm Local Backend Health

### Task 1: Run Baseline Backend Checks

**Files:** No file changes.

- [ ] **Step 1: Install backend dependencies**

Run from repo root:

```bash
make backend-install
```

Expected: `uv sync` completes without dependency errors.

- [ ] **Step 2: Run backend tests**

```bash
make backend-test
```

Expected: all tests pass before deployment work begins.

- [ ] **Step 3: Start backend locally**

```bash
make backend-dev
```

Expected: Uvicorn starts on `http://localhost:8000`.

- [ ] **Step 4: Verify health**

```bash
make backend-check
```

Expected:

```text
Backend is live at http://localhost:8000
```

---

## Phase 2: Create AWS Resources With CLI

### Task 2: Configure AWS CLI Variables

**Files:** No file changes.

- [ ] **Step 1: Confirm AWS identity**

```bash
aws sts get-caller-identity --profile "$AWS_PROFILE"
```

Expected: account, user/role ARN, and user ID are printed.

- [ ] **Step 2: Confirm region**

```bash
aws configure get region --profile "$AWS_PROFILE"
```

Expected: `ap-south-1` or the user-approved region.

### Task 3: Create DynamoDB Table

**Files:** No file changes.

- [ ] **Step 1: Create one single-table DynamoDB table**

```bash
aws dynamodb create-table \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --table-name "$DDB_TABLE" \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST
```

Expected: table status starts as `CREATING`.

- [ ] **Step 2: Wait for table**

```bash
aws dynamodb wait table-exists \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --table-name "$DDB_TABLE"
```

Expected: command exits with status `0`.

### Task 4: Create S3 Bucket

**Files:** No file changes.

- [ ] **Step 1: Create private bucket**

For `ap-south-1`:

```bash
aws s3api create-bucket \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --bucket "$S3_BUCKET" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"
```

Expected: bucket is created.

- [ ] **Step 2: Block public access**

```bash
aws s3api put-public-access-block \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --bucket "$S3_BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Expected: command exits with status `0`.

- [ ] **Step 3: Enable default encryption**

```bash
aws s3api put-bucket-encryption \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --bucket "$S3_BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

Expected: command exits with status `0`.

### Task 5: Store Secrets And Config

**Files:** No file changes.

- [ ] **Step 1: Store OpenAI key in SSM Parameter Store**

```bash
aws ssm put-parameter \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --name "/$APP_NAME/$ENV_NAME/OPENAI_API_KEY" \
  --type "SecureString" \
  --value "$OPENAI_API_KEY" \
  --overwrite
```

Expected: parameter version is printed.

- [ ] **Step 2: Store app config parameters**

```bash
aws ssm put-parameter \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --name "/$APP_NAME/$ENV_NAME/DDB_TABLE" \
  --type "String" \
  --value "$DDB_TABLE" \
  --overwrite

aws ssm put-parameter \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --name "/$APP_NAME/$ENV_NAME/S3_BUCKET" \
  --type "String" \
  --value "$S3_BUCKET" \
  --overwrite
```

Expected: parameter versions are printed.

### Task 6: Create EC2 IAM Role

**Files:** No file changes.

- [ ] **Step 1: Create trust policy file**

Create local file `/tmp/cars24-ec2-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

- [ ] **Step 2: Create IAM role**

```bash
aws iam create-role \
  --profile "$AWS_PROFILE" \
  --role-name "$APP_NAME-$ENV_NAME-ec2-role" \
  --assume-role-policy-document file:///tmp/cars24-ec2-trust-policy.json
```

Expected: role ARN is printed.

- [ ] **Step 3: Create least-privilege app policy**

Create local file `/tmp/cars24-ec2-app-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": "arn:aws:dynamodb:ap-south-1:ACCOUNT_ID:table/cars24-jockey-hack"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::BUCKET_NAME/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:ap-south-1:ACCOUNT_ID:parameter/cars24-jockey/hack/*"
    }
  ]
}
```

Replace `ACCOUNT_ID`, `BUCKET_NAME`, and region if not using `ap-south-1`.

- [ ] **Step 4: Attach inline role policy**

```bash
aws iam put-role-policy \
  --profile "$AWS_PROFILE" \
  --role-name "$APP_NAME-$ENV_NAME-ec2-role" \
  --policy-name "$APP_NAME-$ENV_NAME-app-policy" \
  --policy-document file:///tmp/cars24-ec2-app-policy.json
```

Expected: command exits with status `0`.

- [ ] **Step 5: Create instance profile and attach role**

```bash
aws iam create-instance-profile \
  --profile "$AWS_PROFILE" \
  --instance-profile-name "$APP_NAME-$ENV_NAME-instance-profile"

aws iam add-role-to-instance-profile \
  --profile "$AWS_PROFILE" \
  --instance-profile-name "$APP_NAME-$ENV_NAME-instance-profile" \
  --role-name "$APP_NAME-$ENV_NAME-ec2-role"
```

Expected: commands exit with status `0`.

### Task 7: Create Security Group

**Files:** No file changes.

- [ ] **Step 1: Get default VPC**

```bash
export VPC_ID=$(aws ec2 describe-vpcs \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' \
  --output text)
```

Expected: `VPC_ID` is a `vpc-...` value.

- [ ] **Step 2: Create security group**

```bash
export SG_ID=$(aws ec2 create-security-group \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --group-name "$APP_NAME-$ENV_NAME-backend-sg" \
  --description "Cars24 Jockey backend public HTTPS and restricted SSH" \
  --vpc-id "$VPC_ID" \
  --query GroupId \
  --output text)
```

Expected: `SG_ID` is an `sg-...` value.

- [ ] **Step 3: Allow HTTP and HTTPS**

```bash
aws ec2 authorize-security-group-ingress \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

Expected: commands exit with status `0`.

- [ ] **Step 4: Allow SSH only from current IP**

```bash
export MY_IP=$(curl -fsS https://checkip.amazonaws.com | tr -d '\n')

aws ec2 authorize-security-group-ingress \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port 22 \
  --cidr "$MY_IP/32"
```

Expected: command exits with status `0`.

### Task 8: Launch EC2 Instance

**Files:** No file changes.

- [ ] **Step 1: Create SSH key pair**

```bash
aws ec2 create-key-pair \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --key-name "$KEY_NAME" \
  --query 'KeyMaterial' \
  --output text > "$KEY_NAME.pem"

chmod 400 "$KEY_NAME.pem"
```

Expected: `cars24-jockey-hack-key.pem` exists locally.

- [ ] **Step 2: Find latest Ubuntu AMI**

```bash
export AMI_ID=$(aws ec2 describe-images \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --owners 099720109477 \
  --filters \
    "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
    "Name=state,Values=available" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)
```

Expected: `AMI_ID` is an `ami-...` value.

- [ ] **Step 3: Launch instance**

```bash
export INSTANCE_ID=$(aws ec2 run-instances \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --image-id "$AMI_ID" \
  --instance-type "$EC2_INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --iam-instance-profile Name="$APP_NAME-$ENV_NAME-instance-profile" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$APP_NAME-$ENV_NAME-backend}]" \
  --query 'Instances[0].InstanceId' \
  --output text)
```

Expected: `INSTANCE_ID` is an `i-...` value.

- [ ] **Step 4: Wait for instance**

```bash
aws ec2 wait instance-running \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID"
```

Expected: command exits with status `0`.

- [ ] **Step 5: Get public IP**

```bash
export EC2_PUBLIC_IP=$(aws ec2 describe-instances \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "$EC2_PUBLIC_IP"
```

Expected: public IPv4 address is printed.

---

## Phase 3: Prepare The EC2 Host

### Task 9: Install Docker And Runtime Tools

**Files:** No repo file changes if performed manually over SSH.

- [ ] **Step 1: SSH into EC2**

```bash
ssh -i "$KEY_NAME.pem" ubuntu@"$EC2_PUBLIC_IP"
```

Expected: shell opens on EC2.

- [ ] **Step 2: Install Docker**

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git unzip
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Expected: Docker installs successfully.

- [ ] **Step 3: Reconnect and verify Docker**

```bash
exit
ssh -i "$KEY_NAME.pem" ubuntu@"$EC2_PUBLIC_IP" "docker --version && docker compose version"
```

Expected: Docker and Compose versions are printed.

---

## Phase 4: Add Backend AWS Support

### Task 10: Add AWS Dependencies

**Files:**

- Modify: `backend/pyproject.toml`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add `boto3` to backend dependencies**

Add:

```toml
"boto3>=1.34.0",
```

Expected: dependency appears under `[project].dependencies`.

- [ ] **Step 2: Sync dependencies**

```bash
make backend-install
```

Expected: `uv.lock` updates and dependency install succeeds.

### Task 11: Add Config Module

**Files:**

- Create: `backend/app/config.py`

- [ ] **Step 1: Create config file**

```python
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class AppConfig:
    storage_backend: str
    aws_region: str
    dynamodb_table: str | None
    s3_bucket: str | None
    public_base_url: str


def get_app_config() -> AppConfig:
    return AppConfig(
        storage_backend=os.environ.get("JOCKEY_COPILOT_STORAGE_BACKEND", "sqlite"),
        aws_region=os.environ.get("AWS_REGION", "ap-south-1"),
        dynamodb_table=os.environ.get("JOCKEY_COPILOT_DDB_TABLE"),
        s3_bucket=os.environ.get("JOCKEY_COPILOT_S3_BUCKET"),
        public_base_url=os.environ.get("JOCKEY_COPILOT_PUBLIC_BASE_URL", "http://localhost:8000"),
    )
```

- [ ] **Step 2: Run tests**

```bash
make backend-test
```

Expected: existing tests still pass.

### Task 12: Add DynamoDB Repository Layer

**Files:**

- Create: `backend/app/storage/dynamodb_store.py`
- Modify: `backend/app/database/__init__.py`
- Test: `backend/tests/test_aws_storage_contracts.py`

- [ ] **Step 1: Write failing key-shape test**

```python
from app.storage.dynamodb_store import keys_for_session_item


def test_keys_for_session_item():
    assert keys_for_session_item("insp_123", "META") == {
        "PK": "SESSION#insp_123",
        "SK": "META",
    }
```

Run:

```bash
cd backend && uv run pytest tests/test_aws_storage_contracts.py::test_keys_for_session_item -v
```

Expected: fails because module/function does not exist.

- [ ] **Step 2: Implement key helper**

```python
def keys_for_session_item(session_id: str, sort_key: str) -> dict[str, str]:
    return {
        "PK": f"SESSION#{session_id}",
        "SK": sort_key,
    }
```

- [ ] **Step 3: Add DynamoDB item conventions**

Use these records:

```text
PK=SESSION#{sessionId}, SK=META
PK=SESSION#{sessionId}, SK=STEP#{stepId}
PK=SESSION#{sessionId}, SK=EVIDENCE#{evidenceId}
PK=SESSION#{sessionId}, SK=OBS#{observationId}
PK=SESSION#{sessionId}, SK=AI#{interventionId}
PK=SESSION#{sessionId}, SK=REPORT
PK=PROFILE#{profileId}, SK=META
PK=VEHICLE#{registrationNumber}, SK=META
PK=PLAN_TEMPLATE#{templateId}, SK=META
PK=PLAN_TEMPLATE#{templateId}, SK=STEP#{sortOrderPadded}
```

- [ ] **Step 4: Implement existing database function equivalents**

Implement DynamoDB versions for every function imported by route files from `app.database`, including:

```text
build_inspection_plan
save_session_payload
load_session_payload
activate_first_step
complete_step_and_activate_next
count_completed_steps
set_session_status
get_session_step
save_evidence_item
set_step_status
save_ai_intervention
save_structured_observation
```

- [ ] **Step 5: Route storage backend**

In `backend/app/database/__init__.py`, select DynamoDB implementations only when:

```text
JOCKEY_COPILOT_STORAGE_BACKEND=dynamodb
```

Default remains SQLite so local tests stay stable.

- [ ] **Step 6: Run backend tests**

```bash
make backend-test
```

Expected: all tests pass.

### Task 13: Add S3 Presigned Upload Support

**Files:**

- Create: `backend/app/storage/s3_store.py`
- Create or modify: `backend/app/routes/uploads.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_aws_storage_contracts.py`

- [ ] **Step 1: Write failing object key test**

```python
from app.storage.s3_store import photo_object_key


def test_photo_object_key():
    assert (
        photo_object_key("insp_123", "front-main")
        == "sessions/insp_123/photos/front-main.jpg"
    )
```

Run:

```bash
cd backend && uv run pytest tests/test_aws_storage_contracts.py::test_photo_object_key -v
```

Expected: fails because module/function does not exist.

- [ ] **Step 2: Implement object key helpers**

```python
def photo_object_key(session_id: str, step_id: str) -> str:
    return f"sessions/{session_id}/photos/{step_id}.jpg"


def audio_object_key(session_id: str) -> str:
    return f"sessions/{session_id}/audio/engine.m4a"


def report_json_object_key(session_id: str) -> str:
    return f"sessions/{session_id}/reports/report.json"


def report_html_object_key(session_id: str) -> str:
    return f"sessions/{session_id}/reports/report.html"
```

- [ ] **Step 3: Add presign route contract**

`POST /uploads/presign` request:

```json
{
  "sessionId": "insp_123",
  "stepId": "front-main",
  "kind": "photo",
  "contentType": "image/jpeg"
}
```

Response:

```json
{
  "uploadUrl": "https://...",
  "objectKey": "sessions/insp_123/photos/front-main.jpg",
  "expiresIn": 900
}
```

- [ ] **Step 4: Implement S3 presign function**

Use `boto3.client("s3").generate_presigned_url("put_object", ...)` with:

```text
Bucket = configured bucket
Key = object key
ContentType = request content type
ExpiresIn = 900
```

- [ ] **Step 5: Include route in app**

In `backend/app/main.py`:

```python
from app.routes.uploads import router as uploads_router

app.include_router(uploads_router)
```

- [ ] **Step 6: Run tests**

```bash
make backend-test
```

Expected: all tests pass.

### Task 14: Fix Step Transition Reliability

**Files:**

- Modify: DynamoDB or SQLite implementation of `complete_step_and_activate_next`
- Test: `backend/tests/test_inspection_loop.py`

- [ ] **Step 1: Add regression test for needs-observation completion**

Test flow:

```text
create session
start session
save photo for lhs-front-door
assert lhs-front-door status is needs_observation
POST /ai/structure-observation
assert lhs-front-door status is completed
assert next step is active
assert session is not stuck at needs_observation
```

- [ ] **Step 2: Ensure state machine is explicit**

Allowed transitions:

```text
pending -> active
active -> completed
active -> needs_observation
needs_observation -> completed
completed -> completed
```

- [ ] **Step 3: Run inspection loop tests**

```bash
cd backend && uv run pytest tests/test_inspection_loop.py -v
```

Expected: tests pass and app no longer gets stuck at `needs_observation`.

### Task 15: Reduce Repeated AI Guidance

**Files:**

- Modify: `backend/app/routes/ai.py`
- Modify: `backend/app/services/ai_stub.py` only if needed
- Test: `backend/tests/test_inspection_loop.py` or new focused test

- [ ] **Step 1: Add repeated-guidance test**

Test two identical live-frame requests for the same `sessionId + stepId + sampleKey`.

Expected behavior:

```text
first response: normal guidance
second response: same state is allowed, but message should be shortened or marked as repeated
```

- [ ] **Step 2: Store last guidance in AI intervention payload**

For each `SESSION#{sessionId} / AI#...`, include:

```json
{
  "stepId": "front-main",
  "sampleKey": "front-main-bad-cropped",
  "guidance": "Move two steps back and center the bumper",
  "status": "adjust"
}
```

- [ ] **Step 3: Suppress exact duplicates**

If latest guidance for the same step has same `status` and same `guidance`, return:

```text
Still adjusting. Hold this position and center the bumper.
```

or keep the same message but expose:

```json
{
  "isRepeated": true
}
```

- [ ] **Step 4: Run tests**

```bash
make backend-test
```

Expected: all tests pass.

---

## Phase 5: Containerize Backend

### Task 16: Add Backend Dockerfile

**Files:**

- Create: `backend/Dockerfile`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Build locally**

```bash
docker build -t cars24-jockey-backend:local backend
```

Expected: image builds.

- [ ] **Step 3: Run locally**

```bash
docker run --rm -p 8000:8000 cars24-jockey-backend:local
```

Expected: backend starts.

- [ ] **Step 4: Verify health**

```bash
curl -fsS http://localhost:8000/health
```

Expected:

```json
{"status":"ok"}
```

### Task 17: Add Compose And Reverse Proxy

**Files:**

- Create: `deploy/docker-compose.yml`
- Create: `deploy/Caddyfile`

- [ ] **Step 1: Add Docker Compose**

```yaml
services:
  backend:
    build:
      context: ../backend
    restart: unless-stopped
    environment:
      AWS_REGION: ${AWS_REGION}
      JOCKEY_COPILOT_STORAGE_BACKEND: dynamodb
      JOCKEY_COPILOT_DDB_TABLE: ${JOCKEY_COPILOT_DDB_TABLE}
      JOCKEY_COPILOT_S3_BUCKET: ${JOCKEY_COPILOT_S3_BUCKET}
      JOCKEY_COPILOT_PUBLIC_BASE_URL: ${JOCKEY_COPILOT_PUBLIC_BASE_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    expose:
      - "8000"

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - backend

volumes:
  caddy_data:
  caddy_config:
```

- [ ] **Step 2: Add Caddyfile for IP-only demo**

```text
:80 {
  reverse_proxy backend:8000
}
```

If a domain is available later:

```text
api.example.com {
  reverse_proxy backend:8000
}
```

- [ ] **Step 3: Test compose locally**

```bash
cd deploy && docker compose up --build
```

Expected: Caddy and backend start.

- [ ] **Step 4: Verify proxy**

```bash
curl -fsS http://localhost/health
```

Expected:

```json
{"status":"ok"}
```

---

## Phase 6: Deploy App To EC2

### Task 18: Copy Code To EC2

**Files:** No repo file changes during deployment.

- [ ] **Step 1: Create app directory**

```bash
ssh -i "$KEY_NAME.pem" ubuntu@"$EC2_PUBLIC_IP" "mkdir -p ~/cars24-jockey"
```

Expected: command exits with status `0`.

- [ ] **Step 2: Copy backend and deploy files**

```bash
rsync -avz \
  -e "ssh -i $KEY_NAME.pem" \
  --exclude '.git' \
  --exclude 'mobile/node_modules' \
  --exclude 'backend/.local' \
  ./ ubuntu@"$EC2_PUBLIC_IP":~/cars24-jockey/
```

Expected: files sync to EC2.

### Task 19: Create EC2 Environment File

**Files:** No committed secret file.

- [ ] **Step 1: Fetch parameters and write `.env` on EC2**

```bash
ssh -i "$KEY_NAME.pem" ubuntu@"$EC2_PUBLIC_IP" "
  cd ~/cars24-jockey/deploy &&
  cat > .env <<EOF
AWS_REGION=$AWS_REGION
JOCKEY_COPILOT_STORAGE_BACKEND=dynamodb
JOCKEY_COPILOT_DDB_TABLE=$DDB_TABLE
JOCKEY_COPILOT_S3_BUCKET=$S3_BUCKET
JOCKEY_COPILOT_PUBLIC_BASE_URL=http://$EC2_PUBLIC_IP
OPENAI_API_KEY=\$(aws ssm get-parameter --region $AWS_REGION --name /$APP_NAME/$ENV_NAME/OPENAI_API_KEY --with-decryption --query Parameter.Value --output text)
EOF
"
```

Expected: `deploy/.env` exists on EC2 and is not committed.

### Task 20: Start Backend On EC2

**Files:** No repo file changes.

- [ ] **Step 1: Start services**

```bash
ssh -i "$KEY_NAME.pem" ubuntu@"$EC2_PUBLIC_IP" "
  cd ~/cars24-jockey/deploy &&
  docker compose up -d --build
"
```

Expected: Docker containers build and start.

- [ ] **Step 2: Check containers**

```bash
ssh -i "$KEY_NAME.pem" ubuntu@"$EC2_PUBLIC_IP" "
  cd ~/cars24-jockey/deploy &&
  docker compose ps
"
```

Expected: `backend` and `caddy` are running.

- [ ] **Step 3: Verify remote health**

```bash
curl -fsS "http://$EC2_PUBLIC_IP/health"
```

Expected:

```json
{"status":"ok"}
```

---

## Phase 7: Seed Demo Data And Smoke Test

### Task 21: Seed DynamoDB

**Files:**

- Modify: `backend/app/seed.py` only if it does not support DynamoDB through the selected database backend.

- [ ] **Step 1: Run seed command on EC2**

```bash
ssh -i "$KEY_NAME.pem" ubuntu@"$EC2_PUBLIC_IP" "
  cd ~/cars24-jockey/deploy &&
  docker compose exec backend python -m app.seed seed
"
```

Expected: demo vehicle and plan records exist in DynamoDB.

- [ ] **Step 2: Verify table has records**

```bash
aws dynamodb scan \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --table-name "$DDB_TABLE" \
  --select COUNT
```

Expected: `Count` is greater than `0`.

### Task 22: Smoke Test API

**Files:** No file changes.

- [ ] **Step 1: Health**

```bash
curl -fsS "http://$EC2_PUBLIC_IP/health"
```

Expected:

```json
{"status":"ok"}
```

- [ ] **Step 2: Vehicle lookup**

```bash
curl -fsS "http://$EC2_PUBLIC_IP/vehicles/lookup" \
  -H "Content-Type: application/json" \
  -d '{"registrationNumber":"KA03MX2147"}'
```

Expected: Hyundai Creta demo profile.

- [ ] **Step 3: Create session**

```bash
curl -fsS "http://$EC2_PUBLIC_IP/sessions" \
  -H "Content-Type: application/json" \
  -d '{"registrationNumber":"KA03MX2147"}'
```

Expected: response includes `sessionId` and inspection plan.

- [ ] **Step 4: Start session**

```bash
curl -fsS "http://$EC2_PUBLIC_IP/sessions/$SESSION_ID/start" \
  -H "Content-Type: application/json" \
  -d '{"jockeyName":"Demo Jockey","languageCode":"en-IN"}'
```

Expected: response includes active first step.

- [ ] **Step 5: Presign photo upload**

```bash
curl -fsS "http://$EC2_PUBLIC_IP/uploads/presign" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"'"$SESSION_ID"'","stepId":"front-main","kind":"photo","contentType":"image/jpeg"}'
```

Expected: response includes `uploadUrl` and `objectKey`.

- [ ] **Step 6: AI live frame**

```bash
curl -fsS "http://$EC2_PUBLIC_IP/ai/analyze-live-frame" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"'"$SESSION_ID"'","stepId":"front-main","sampleKey":"front-main-good"}'
```

Expected: response includes `readyToCapture`.

---

## Phase 8: Mobile Integration

### Task 23: Point Mobile At EC2 Backend

**Files:**

- Modify only the existing mobile environment/config file used for API base URL.

- [ ] **Step 1: Set API base URL**

Use:

```text
http://EC2_PUBLIC_IP
```

If using a domain and HTTPS:

```text
https://api.example.com
```

- [ ] **Step 2: Start mobile**

```bash
make mobile-start
```

Expected: Expo starts.

- [ ] **Step 3: Run end-to-end demo**

Flow:

```text
onboarding
vehicle lookup for KA03MX2147
create session
start inspection
front-main guidance
photo evidence upload
lhs-front-door needs_observation
structure observation
engine check
complete session
report link
```

Expected: app does not get stuck at `needs_observation`, and AI guidance does not spam the same instruction forever.

---

## Phase 9: Optional Domain And HTTPS

### Task 24: Attach Domain

**Files:**

- Modify: `deploy/Caddyfile`

- [ ] **Step 1: Create Elastic IP**

```bash
export ALLOCATION_ID=$(aws ec2 allocate-address \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --domain vpc \
  --query AllocationId \
  --output text)

aws ec2 associate-address \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --instance-id "$INSTANCE_ID" \
  --allocation-id "$ALLOCATION_ID"
```

Expected: EC2 has stable public IP.

- [ ] **Step 2: Create DNS A record**

If domain is in Route 53, use `aws route53 change-resource-record-sets`.

Desired record:

```text
api.yourdomain.com A EC2_ELASTIC_IP
```

- [ ] **Step 3: Update Caddyfile**

```text
api.yourdomain.com {
  reverse_proxy backend:8000
}
```

- [ ] **Step 4: Restart Caddy**

```bash
ssh -i "$KEY_NAME.pem" ubuntu@"$EC2_PUBLIC_IP" "
  cd ~/cars24-jockey/deploy &&
  docker compose restart caddy
"
```

Expected: Caddy obtains HTTPS certificate automatically.

- [ ] **Step 5: Verify HTTPS**

```bash
curl -fsS "https://api.yourdomain.com/health"
```

Expected:

```json
{"status":"ok"}
```

---

## Phase 10: Operational Checks

### Task 25: Add Basic Server Commands

**Files:**

- Create: `deploy/aws/check-deployment.sh`

- [ ] **Step 1: Add check script**

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:?Usage: ./check-deployment.sh http://host-or-https-domain}"

curl -fsS "$BASE_URL/health"
curl -fsS "$BASE_URL/vehicles/lookup" \
  -H "Content-Type: application/json" \
  -d '{"registrationNumber":"KA03MX2147"}' >/dev/null

echo "Deployment smoke checks passed for $BASE_URL"
```

- [ ] **Step 2: Run script**

```bash
bash deploy/aws/check-deployment.sh "http://$EC2_PUBLIC_IP"
```

Expected:

```text
Deployment smoke checks passed for http://...
```

### Task 26: Know The Recovery Commands

**Files:** No file changes.

- [ ] **Step 1: View backend logs**

```bash
ssh -i "$KEY_NAME.pem" ubuntu@"$EC2_PUBLIC_IP" "
  cd ~/cars24-jockey/deploy &&
  docker compose logs -f backend
"
```

- [ ] **Step 2: Restart backend**

```bash
ssh -i "$KEY_NAME.pem" ubuntu@"$EC2_PUBLIC_IP" "
  cd ~/cars24-jockey/deploy &&
  docker compose restart backend
"
```

- [ ] **Step 3: Redeploy latest code**

```bash
rsync -avz \
  -e "ssh -i $KEY_NAME.pem" \
  --exclude '.git' \
  --exclude 'mobile/node_modules' \
  --exclude 'backend/.local' \
  ./ ubuntu@"$EC2_PUBLIC_IP":~/cars24-jockey/

ssh -i "$KEY_NAME.pem" ubuntu@"$EC2_PUBLIC_IP" "
  cd ~/cars24-jockey/deploy &&
  docker compose up -d --build
"
```

Expected: new backend container is running.

---

## Acceptance Criteria

Deployment is complete when all of these pass:

```bash
curl -fsS "http://$EC2_PUBLIC_IP/health"
curl -fsS "http://$EC2_PUBLIC_IP/vehicles/lookup" \
  -H "Content-Type: application/json" \
  -d '{"registrationNumber":"KA03MX2147"}'
```

And the mobile demo can complete:

```text
lookup -> create session -> start inspection -> photo evidence -> observation -> engine check -> submit
```

With these fixes verified:

```text
No repeated guidance loop.
No stuck needs_observation state.
S3 contains uploaded evidence objects.
DynamoDB contains session, step, evidence, observation, AI, and report records.
```

## Execution Recommendation

Run this in two passes:

1. **Code readiness pass:** Add DynamoDB/S3 support and regression tests locally.
2. **AWS deployment pass:** Create AWS resources and deploy to EC2 using CLI.

That keeps cloud debugging separate from backend correctness, which is much faster under hackathon pressure.
