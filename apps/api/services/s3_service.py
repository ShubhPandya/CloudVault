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


def generate_presigned_download_url(
    object_key: str,
    file_name: str,
    expires_in: int = 86400,
    force_download: bool = False,
) -> str:
    """Generates a secure S3 download/share URL with custom disposition."""
    params = {
        "Bucket": settings.S3_BUCKET_NAME,
        "Key": object_key,
    }

    if force_download:
        params["ResponseContentDisposition"] = f'attachment; filename="{file_name}"'

    url = s3_client.generate_presigned_url(
        ClientMethod="get_object",
        Params=params,
        ExpiresIn=expires_in,
    )
    return url


def delete_s3_object(object_key: str) -> None:
    """Deletes an object key from the CloudVault S3 bucket."""
    try:
        s3_client.delete_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=object_key,
        )
    except Exception as e:
        print(f"Error deleting {object_key} from S3: {e}")