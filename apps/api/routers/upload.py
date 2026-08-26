import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any

from core.auth import get_current_user
from services.s3_service import (
    generate_presigned_upload_url,
    generate_presigned_download_url,
    delete_s3_object,
)
from services.dynamodb_service import (
    create_asset_record,
    get_user_assets,
    get_asset_by_id,
    delete_asset_record,
    table,
)
from services.delivery_service import get_delivery_url

router = APIRouter(prefix="/api/v1/assets", tags=["Assets"])


class PresignedUrlRequest(BaseModel):
    file_name: str
    content_type: str


class PresignedUrlResponse(BaseModel):
    upload_url: str
    asset_id: str
    s3_key: str


@router.post("/presigned-upload", response_model=PresignedUrlResponse)
async def create_presigned_upload(
    payload: PresignedUrlRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("user_id") or current_user.get("sub") or "anonymous"
    asset_id = str(uuid.uuid4())
    raw_s3_key = f"uploads/{user_id}/{asset_id}/{payload.file_name}"

    upload_url = generate_presigned_upload_url(
        object_key=raw_s3_key,
        content_type=payload.content_type,
    )

    create_asset_record(
        user_id=user_id,
        asset_id=asset_id,
        file_name=payload.file_name,
        content_type=payload.content_type,
        raw_s3_key=raw_s3_key,
        status="PENDING_UPLOAD",
    )

    return PresignedUrlResponse(
        upload_url=upload_url,
        asset_id=asset_id,
        s3_key=raw_s3_key,
    )


@router.get("/", response_model=List[Dict[str, Any]])
async def list_assets(
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("user_id") or current_user.get("sub") or "anonymous"
    raw_items = get_user_assets(user_id)
    normalized_items = []

    for item in raw_items:
        asset_id = item.get("asset_id") or item.get("id")
        if not asset_id and "SK" in item and "#" in item["SK"]:
            asset_id = item["SK"].split("#", 1)[1]

        file_name = item.get("file_name") or item.get("filename") or "unnamed_asset"
        content_type = item.get("content_type") or item.get("contentType") or "application/octet-stream"
        raw_s3_key = item.get("raw_s3_key") or item.get("s3_key") or ""
        item_status = item.get("status") or "PENDING_UPLOAD"

        doc: Dict[str, Any] = {
            "asset_id": asset_id or str(uuid.uuid4()),
            "file_name": file_name,
            "content_type": content_type,
            "status": item_status,
            "raw_s3_key": raw_s3_key,
        }

        if raw_s3_key:
            doc["download_url"] = get_delivery_url(raw_s3_key, file_name)

        normalized_items.append(doc)

    return normalized_items


@router.get("/shared/{asset_id}")
async def get_shared_asset_view(
    asset_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Allows any authenticated user to fetch metadata and temporary access for a shared asset."""
    # Scan by asset_id or matching SK pattern
    scan_res = table.scan(
        FilterExpression="asset_id = :aid OR SK = :sk OR GSI1SK = :gsk",
        ExpressionAttributeValues={
            ":aid": asset_id,
            ":sk": f"ASSET#{asset_id}",
            ":gsk": f"ASSET#{asset_id}",
        },
        Limit=5,
    )
    items = scan_res.get("Items", [])

    if not items:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared asset not found")

    asset = items[0]
    raw_key = asset.get("raw_s3_key") or asset.get("s3_key")
    file_name = asset.get("file_name") or asset.get("filename") or "shared_file"

    download_url = generate_presigned_download_url(
        object_key=raw_key,
        file_name=file_name,
        expires_in=86400,
        force_download=False,
    )

    return {
        "asset_id": asset_id,
        "file_name": file_name,
        "content_type": asset.get("content_type", "application/octet-stream"),
        "status": asset.get("status", "COMPLETED"),
        "raw_s3_key": raw_key,
        "download_url": download_url,
    }


@router.get("/{asset_id}/download-url")
async def get_download_url(
    asset_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("user_id") or current_user.get("sub") or "anonymous"
    asset = get_asset_by_id(user_id, asset_id)

    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    raw_key = asset.get("raw_s3_key") or asset.get("s3_key")
    file_name = asset.get("file_name") or asset.get("filename") or "download"

    download_url = generate_presigned_download_url(
        object_key=raw_key,
        file_name=file_name,
        expires_in=300,
        force_download=True,
    )
    return {"download_url": download_url, "file_name": file_name}


@router.delete("/{asset_id}", status_code=status.HTTP_200_OK)
async def remove_asset(
    asset_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("user_id") or current_user.get("sub") or "anonymous"
    asset = get_asset_by_id(user_id, asset_id)

    if asset:
        raw_key = asset.get("raw_s3_key") or asset.get("s3_key")
        if raw_key:
            delete_s3_object(raw_key)

        processed_key = asset.get("processed_s3_key")
        if processed_key:
            delete_s3_object(processed_key)

    delete_asset_record(user_id, asset_id)
    return {"message": "Asset deleted successfully", "asset_id": asset_id}