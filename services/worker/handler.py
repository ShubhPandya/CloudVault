import os
import json
import urllib.parse
from datetime import datetime, timezone
import boto3
from PIL import Image
import io

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table_name = os.environ.get("TABLE_NAME", "cloudvault-table-dev")
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    print("Received event:", json.dumps(event))

    for record in event.get("Records", []):
        body = json.loads(record["body"])

        if "Records" in body:
            for s3_record in body["Records"]:
                bucket = s3_record["s3"]["bucket"]["name"]
                key = urllib.parse.unquote_plus(s3_record["s3"]["object"]["key"])

                # Key layout: uploads/<user_id>/<asset_id>/<file_name>
                parts = key.split("/")
                if len(parts) >= 4 and parts[0] == "uploads":
                    user_id = parts[1]
                    asset_id = parts[2]
                    file_name = "/".join(parts[3:])
                else:
                    print(f"Skipping unparseable key: {key}")
                    continue

                print(f"Processing asset: User={user_id}, AssetId={asset_id}, Key={key}")

                try:
                    # 1. Download raw file from S3
                    response = s3.get_object(Bucket=bucket, Key=key)
                    file_bytes = response["Body"].read()
                    size_bytes = len(file_bytes)

                    # 2. Thumbnail Processing via Pillow
                    thumb_key = f"processed/{user_id}/{asset_id}/thumb_{file_name}.webp"
                    try:
                        image = Image.open(io.BytesIO(file_bytes))
                        image.thumbnail((300, 300))
                        thumb_buffer = io.BytesIO()
                        image.save(thumb_buffer, format="WEBP")
                        thumb_buffer.seek(0)

                        s3.put_object(
                            Bucket=bucket,
                            Key=thumb_key,
                            Body=thumb_buffer,
                            ContentType="image/webp",
                        )
                    except Exception as img_err:
                        print(f"Thumbnail skipped (non-image): {img_err}")
                        thumb_key = ""

                    # 3. Update DynamoDB Status to COMPLETED
                    now_iso = datetime.now(timezone.utc).isoformat()
                    update_expr = "SET #st = :completed, sizeBytes = :size, updatedAt = :updated"
                    attr_names = {"#st": "status"}
                    attr_vals = {
                        ":completed": "COMPLETED",
                        ":size": size_bytes,
                        ":updated": now_iso,
                    }

                    if thumb_key:
                        update_expr += ", s3KeyThumb = :thumb"
                        attr_vals[":thumb"] = thumb_key

                    table.update_item(
                        Key={
                            "PK": f"USER#{user_id}",
                            "SK": f"ASSET#{asset_id}",
                        },
                        UpdateExpression=update_expr,
                        ExpressionAttributeNames=attr_names,
                        ExpressionAttributeValues=attr_vals,
                    )
                    print(f"Successfully updated asset {asset_id} to COMPLETED")

                except Exception as e:
                    print(f"Failed processing object {key}: {str(e)}")
                    table.update_item(
                        Key={
                            "PK": f"USER#{user_id}",
                            "SK": f"ASSET#{asset_id}",
                        },
                        UpdateExpression="SET #st = :failed",
                        ExpressionAttributeNames={"#st": "status"},
                        ExpressionAttributeValues={":failed": "FAILED"},
                    )

    return {"statusCode": 200, "body": "Batch processed"}