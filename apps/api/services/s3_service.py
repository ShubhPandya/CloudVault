import boto3
from botocore.config import Config
from core.config import get_settings

settings = get_settings()

s3_client = boto3.client(
    "s3",
    region_name=settings.AWS_REGION,
    config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
)


def generate_presigned_upload_url(
    object_key: str,
    content_type: str,
    expires_in: int = 300,
) -> str:
    """Generates an AWS SigV4 presigned PUT URL for client-side direct ingestion."""
    params = {
        "Bucket": settings.S3_BUCKET_NAME,
        "Key": object_key,
        "ContentType": content_type,
    }

    url = s3_client.generate_presigned_url(
        ClientMethod="put_object",
        Params=params,
        ExpiresIn=expires_in,
        HttpMethod="PUT",
    )
    return url