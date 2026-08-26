from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # App General Settings
    PROJECT_NAME: str = "CloudVault API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # AWS Configuration
    AWS_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None

    # S3, DynamoDB & CloudFront
    S3_BUCKET_NAME: str = "cloudvault-raw-assets-dev"
    DYNAMODB_TABLE_NAME: str = "cloudvault-table-dev"
    CLOUDFRONT_DOMAIN: str = ""

    # Security & JWT
    JWT_SECRET: str = "cloudvault-dev-jwt-super-secret-key-change-in-prod"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Redis (Optional/Local Fallback)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()