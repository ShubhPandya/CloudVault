from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List
import boto3
from boto3.dynamodb.conditions import Key
from core.config import get_settings

settings = get_settings()

dynamodb = boto3.resource("dynamodb", region_name=settings.AWS_REGION)
table_name = f"cloudvault-table-{settings.ENVIRONMENT}" if settings.ENVIRONMENT != "development" else "cloudvault-table-dev"
table = dynamodb.Table(table_name)


def _convert_decimals(obj: Any) -> Any:
    """Helper to convert Boto3 Decimal objects into standard Python int/float for JSON serialization."""
    if isinstance(obj, list):
        return [_convert_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: _convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj


def create_asset_record(
    asset_id: str,
    user_id: str,
    file_name: str,
    s3_key: str,
    mime_type: str,
) -> Dict[str, Any]:
    """Inserts the initial asset tracking record into DynamoDB single-table store."""
    now_iso = datetime.now(timezone.utc).isoformat()
    item = {
        "PK": f"USER#{user_id}",
        "SK": f"ASSET#{asset_id}",
        "assetId": asset_id,
        "userId": user_id,
        "fileName": file_name,
        "s3KeyRaw": s3_key,
        "s3KeyThumb": "",
        "mimeType": mime_type,
        "status": "PENDING_UPLOAD",
        "createdAt": now_iso,
        "updatedAt": now_iso,
        "sizeBytes": 0,
        "metadata": {},
    }
    table.put_item(Item=item)
    return item


def get_user_assets(user_id: str) -> List[Dict[str, Any]]:
    """Queries all asset items for a given user partition key and maps fields to the API schema."""
    response = table.query(
        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("ASSET#"),
        ScanIndexForward=False,
    )
    raw_items = response.get("Items", [])
    sanitized_items = _convert_decimals(raw_items)

    formatted_items = []
    for item in sanitized_items:
        formatted_items.append({
            "assetId": item.get("assetId") or item.get("SK", "").replace("ASSET#", ""),
            "userId": item.get("userId") or item.get("PK", "").replace("USER#", ""),
            "fileName": item.get("fileName", item.get("SK", "").replace("ASSET#", "")),
            "s3KeyRaw": item.get("s3KeyRaw", f"uploads/{user_id}/{item.get('SK', '').replace('ASSET#', '')}"),
            "s3KeyThumb": item.get("s3KeyThumb", ""),
            "mimeType": item.get("mimeType", "image/png"),
            "status": item.get("status", "PENDING_UPLOAD"),
            "createdAt": item.get("createdAt", item.get("updatedAt", datetime.now(timezone.utc).isoformat())),
            "sizeBytes": item.get("sizeBytes", 0),
            "metadata": item.get("metadata", {}),
        })

    return formatted_items