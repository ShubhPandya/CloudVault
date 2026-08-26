import boto3
from core.config import get_settings
from typing import List, Optional, Dict, Any

settings = get_settings()

dynamodb = boto3.resource("dynamodb", region_name=settings.AWS_REGION)
table = dynamodb.Table(settings.DYNAMODB_TABLE_NAME)


def create_asset_record(
    user_id: str,
    asset_id: str,
    file_name: str,
    content_type: str,
    raw_s3_key: str,
    status: str = "PENDING_UPLOAD",
) -> Dict[str, Any]:
    pk = f"USER#{user_id}"
    sk = f"ASSET#{asset_id}"

    item = {
        "PK": pk,
        "SK": sk,
        "asset_id": asset_id,
        "user_id": user_id,
        "file_name": file_name,
        "content_type": content_type,
        "raw_s3_key": raw_s3_key,
        "status": status,
        "GSI1PK": "STATUS#PENDING",
        "GSI1SK": f"ASSET#{asset_id}",
    }
    table.put_item(Item=item)
    return item


def get_user_assets(user_id: str) -> List[Dict[str, Any]]:
    pk = f"USER#{user_id}"
    response = table.query(
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk_prefix)",
        ExpressionAttributeValues={
            ":pk": pk,
            ":sk_prefix": "ASSET#",
        },
        ScanIndexForward=False,
    )
    return response.get("Items", [])


def get_asset_by_id(user_id: str, asset_id: str) -> Optional[Dict[str, Any]]:
    pk = f"USER#{user_id}"
    sk = f"ASSET#{asset_id}"
    response = table.get_item(Key={"PK": pk, "SK": sk})
    return response.get("Item")


def delete_asset_record(user_id: str, asset_id: str) -> None:
    pk = f"USER#{user_id}"
    sk = f"ASSET#{asset_id}"
    table.delete_item(Key={"PK": pk, "SK": sk})