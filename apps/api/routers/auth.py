from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from core.security import hash_password, verify_password, create_access_token
from services.dynamodb_service import dynamodb, settings
import uuid

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])
table = dynamodb.Table(settings.DYNAMODB_TABLE_NAME)


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest):
    # Check if user already exists
    response = table.get_item(Key={"PK": f"USER#{payload.email}", "SK": "METADATA"})
    if "Item" in response:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered",
        )

    user_id = str(uuid.uuid4())
    hashed_pwd = hash_password(payload.password)

    user_item = {
        "PK": f"USER#{payload.email}",
        "SK": "METADATA",
        "user_id": user_id,
        "email": payload.email,
        "password_hash": hashed_pwd,
        "full_name": payload.full_name,
    }

    # Store secondary lookup index by user_id
    id_lookup = {
        "PK": f"USERID#{user_id}",
        "SK": "METADATA",
        "user_id": user_id,
        "email": payload.email,
    }

    table.put_item(Item=user_item)
    table.put_item(Item=id_lookup)

    return {"message": "Account created successfully", "user_id": user_id}


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    response = table.get_item(Key={"PK": f"USER#{payload.email}", "SK": "METADATA"})
    user = response.get("Item")

    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token({"sub": user["user_id"], "email": user["email"]})

    return TokenResponse(
        access_token=token,
        user_id=user["user_id"],
        email=user["email"],
    )