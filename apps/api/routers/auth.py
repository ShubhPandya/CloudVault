import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from core.security import get_password_hash, verify_password, create_access_token
from services.dynamodb_service import table

router = APIRouter()


class AuthRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    name: str
    email: str


@router.post("/signup", response_model=AuthTokenResponse)
async def signup(payload: AuthRegisterRequest):
    response = table.get_item(
        Key={"PK": f"USER_EMAIL#{payload.email.lower()}", "SK": "ACCOUNT"}
    )
    if "Item" in response:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    user_id = str(uuid.uuid4())
    hashed_pwd = get_password_hash(payload.password)
    now_iso = datetime.now(timezone.utc).isoformat()

    table.put_item(
        Item={
            "PK": f"USER_EMAIL#{payload.email.lower()}",
            "SK": "ACCOUNT",
            "userId": user_id,
            "passwordHash": hashed_pwd,
            "name": payload.name,
            "email": payload.email.lower(),
            "createdAt": now_iso,
        }
    )

    token = create_access_token(
        data={"sub": user_id, "email": payload.email.lower(), "name": payload.name}
    )

    return AuthTokenResponse(
        access_token=token,
        user_id=user_id,
        name=payload.name,
        email=payload.email.lower(),
    )


@router.post("/login", response_model=AuthTokenResponse)
async def login(payload: AuthLoginRequest):
    response = table.get_item(
        Key={"PK": f"USER_EMAIL#{payload.email.lower()}", "SK": "ACCOUNT"}
    )
    item = response.get("Item")

    if not item or not verify_password(payload.password, item.get("passwordHash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    token = create_access_token(
        data={"sub": item["userId"], "email": item["email"], "name": item["name"]}
    )

    return AuthTokenResponse(
        access_token=token,
        user_id=item["userId"],
        name=item["name"],
        email=item["email"],
    )