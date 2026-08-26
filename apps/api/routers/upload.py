import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from services.s3_service import generate_presigned_upload_url
from services.dynamodb_service import table
from services.delivery_service import get_cloudfront_url
from core.auth import get_current_user

router = APIRouter()


class PresignedUrlRequest(BaseModel):
    file_name: str
    content_type: str


class PresignedUrlResponse(BaseModel):
    upload_url: str
    s3_key: str
    asset_id: str


class AssetResponse(BaseModel):
    assetId: str
    userId: str
    fileName: str
    s3KeyRaw: str
    s3KeyThumb: Optional[str] = None
    mimeType: str
    status: str
    createdAt: str
    sizeBytes: Optional[int] = None


@router.post("/presigned-upload", response_model=PresignedUrlResponse)
async def create_presigned_upload(
    payload: PresignedUrlRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    asset_id = str(uuid.uuid4())
    raw_s3_key = f"uploads/{user_id}/{asset_id}/{payload.file_name}"

    upload_url = generate_presigned_upload_url(
        object_key=raw_s3_key,
        content_type=payload.content_type,
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    table.put_item(
        Item={
            "PK": f"USER#{user_id}",
            "SK": f"ASSET#{asset_id}",
            "assetId": asset_id,
            "userId": user_id,
            "fileName": payload.file_name,
            "s3KeyRaw": raw_s3_key,
            "mimeType": payload.content_type,
            "status": "PENDING_UPLOAD",
            "createdAt": now_iso,
        }
    )

    return PresignedUrlResponse(
        upload_url=upload_url,
        s3_key=raw_s3_key,
        asset_id=asset_id,
    )


@router.get("/", response_model=List[AssetResponse])
async def list_assets(
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    response = table.query(
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk_prefix)",
        ExpressionAttributeValues={
            ":pk": f"USER#{user_id}",
            ":sk_prefix": "ASSET#",
        },
        ScanIndexForward=False,
    )
    items = response.get("Items", [])
    return [AssetResponse(**item) for item in items]


@router.get("/{asset_id}/download-url")
async def get_download_url(
    asset_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    response = table.get_item(
        Key={"PK": f"USER#{user_id}", "SK": f"ASSET#{asset_id}"}
    )
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")

    cdn_url = get_cloudfront_url(item["s3KeyRaw"])
    return {"download_url": cdn_url, "status": item["status"]}