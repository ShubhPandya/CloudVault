from pydantic import BaseModel
from typing import List
from urllib.parse import unquote_plus


class S3Bucket(BaseModel):
    name: str


class S3Object(BaseModel):
    key: str
    size: int


class S3Entity(BaseModel):
    bucket: S3Bucket
    object: S3Object


class S3Record(BaseModel):
    eventName: str
    s3: S3Entity


class SQSRecord(BaseModel):
    messageId: str
    receiptHandle: str
    body: str


class DecodedS3Event:
    """Helper class to extract and sanitize S3 parameters from SQS body"""
    def __init__(self, bucket_name: str, raw_key: str, user_id: str):
        self.bucket_name = bucket_name
        self.key = unquote_plus(raw_key)  # Handles URL encoded characters (e.g. %20 -> space)
        self.user_id = user_id