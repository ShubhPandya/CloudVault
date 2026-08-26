from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "CloudVault API"
    ENVIRONMENT: str = "development"
    AWS_REGION: str = "ap-south-1"  # Set to Mumbai (ap-south-1)
    
    # Cognito Settings
    COGNITO_USER_POOL_ID: str = "ap-south-1_examplePoolId"
    COGNITO_APP_CLIENT_ID: str = "exampleclientid123456789"
    
    # Presigned S3 Settings
    S3_BUCKET_NAME: str = "cloudvault-raw-assets-dev"
    PRESIGNED_EXPIRATION_SECONDS: int = 900

    # Upstash Redis Settings (Free Tier REST API)
    UPSTASH_REDIS_REST_URL: str = "https://example.upstash.io"
    UPSTASH_REDIS_REST_TOKEN: str = "example_token"
    CACHE_TTL_SECONDS: int = 300

    # CloudFront Edge Delivery Settings
    CLOUDFRONT_DOMAIN: str = "d2gigprwulnub2.cloudfront.net"
    CLOUDFRONT_KEY_PAIR_ID: str = ""
    CLOUDFRONT_PRIVATE_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache()
def get_settings() -> Settings:
    return Settings()