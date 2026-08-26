from core.config import get_settings

settings = get_settings()


def get_cloudfront_url(s3_key: str) -> str:
    """Formats the public CloudFront CDN distribution URL for an S3 asset key."""
    clean_domain = settings.CLOUDFRONT_DOMAIN.replace("https://", "").replace("http://", "").strip("/")
    clean_key = s3_key.lstrip("/")
    return f"https://{clean_domain}/{clean_key}"