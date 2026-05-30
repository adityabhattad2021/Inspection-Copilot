import os

import boto3
from botocore.config import Config


DEFAULT_PRESIGN_EXPIRES_IN = 900


def get_s3_bucket() -> str:
    bucket = os.environ.get("JOCKEY_COPILOT_S3_BUCKET")
    if not bucket:
        raise RuntimeError("JOCKEY_COPILOT_S3_BUCKET is required for S3 storage")
    return bucket


def photo_object_key(session_id: str, step_id: str) -> str:
    return f"sessions/{session_id}/photos/{step_id}.jpg"


def audio_object_key(session_id: str) -> str:
    return f"sessions/{session_id}/audio/engine.m4a"


def report_json_object_key(session_id: str) -> str:
    return f"sessions/{session_id}/reports/report.json"


def report_html_object_key(session_id: str) -> str:
    return f"sessions/{session_id}/reports/report.html"


def create_presigned_upload_url(
    *,
    bucket: str,
    object_key: str,
    content_type: str,
    expires_in: int = DEFAULT_PRESIGN_EXPIRES_IN,
) -> str:
    client = _s3_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )


def create_presigned_download_url(
    *,
    bucket: str,
    object_key: str,
    expires_in: int = DEFAULT_PRESIGN_EXPIRES_IN,
) -> str:
    client = _s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket,
            "Key": object_key,
        },
        ExpiresIn=expires_in,
    )


def upload_bytes(
    *,
    bucket: str,
    object_key: str,
    body: bytes,
    content_type: str,
) -> str:
    client = _s3_client()
    client.put_object(
        Bucket=bucket,
        Key=object_key,
        Body=body,
        ContentType=content_type,
    )
    return f"s3://{bucket}/{object_key}"


def _s3_client():
    region_name = os.environ.get("AWS_REGION")
    endpoint_url = None
    if region_name and region_name != "us-east-1":
        endpoint_url = f"https://s3.{region_name}.amazonaws.com"
    return boto3.client(
        "s3",
        region_name=region_name,
        endpoint_url=endpoint_url,
        config=Config(signature_version="s3v4"),
    )
