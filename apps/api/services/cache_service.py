import json
from decimal import Decimal
from typing import Optional, List, Dict, Any
from core.config import get_settings

settings = get_settings()


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder to serialize Python Decimal objects into integers/floats."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)


def get_cached_assets(user_id: str) -> Optional[List[Dict[str, Any]]]:
    # Development fallback if Upstash Redis credentials are placeholders
    if "example" in settings.UPSTASH_REDIS_REST_URL:
        return None
    try:
        import urllib.request
        url = f"{settings.UPSTASH_REDIS_REST_URL}/get/cache:assets:{user_id}"
        req = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {settings.UPSTASH_REDIS_REST_TOKEN}"}
        )
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("result"):
                return json.loads(data["result"])
    except Exception as e:
        print(f"[Cache Warning] Failed to read key cache:assets:{user_id}: {str(e)}")
    return None


def set_cached_assets(user_id: str, assets: List[Dict[str, Any]]) -> None:
    if "example" in settings.UPSTASH_REDIS_REST_URL:
        return
    try:
        import urllib.request
        url = f"{settings.UPSTASH_REDIS_REST_URL}/setex/cache:assets:{user_id}/{settings.CACHE_TTL_SECONDS}"
        payload = json.dumps(assets, cls=DecimalEncoder).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bearer {settings.UPSTASH_REDIS_REST_TOKEN}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=1.5):
            pass
    except Exception as e:
        print(f"[Cache Warning] Failed to write key cache:assets:{user_id}: {str(e)}")


def invalidate_user_cache(user_id: str) -> None:
    if "example" in settings.UPSTASH_REDIS_REST_URL:
        return
    try:
        import urllib.request
        url = f"{settings.UPSTASH_REDIS_REST_URL}/del/cache:assets:{user_id}"
        req = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {settings.UPSTASH_REDIS_REST_TOKEN}"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=1.5):
            pass
    except Exception as e:
        print(f"[Cache Warning] Failed to invalidate cache for user {user_id}: {str(e)}")