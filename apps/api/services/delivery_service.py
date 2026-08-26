from core.config import get_settings
from services.s3_service import generate_presigned_download_url

settings = get_settings()


def get_delivery_url(object_key: str, file_name: str = "") -> str:
    """Returns CloudFront edge URL if configured, otherwise falls back to S3 presigned URL."""
    if settings.CLOUDFRONT_DOMAIN and settings.CLOUDFRONT_DOMAIN.strip():
        domain = settings.CLOUDFRONT_DOMAIN.strip().replace("https://", "").replace("http://", "")
        return f"https://{domain}/{object_key}"

    return generate_presigned_download_url(
        object_key=object_key,
        file_name=file_name,
        expires_in=86400,
    )