from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import create_access_token
from app.db import get_db
from app.deps import get_current_user
from app.models import User
from app.passwords import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Verified when the email is unknown, so both failure paths take the same time.
_DUMMY_HASH = hash_password("unused-dummy-password")


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str

    @classmethod
    def of(cls, u: User) -> "UserOut":
        return cls(id=u.id, name=u.name, email=u.email, role=u.role.value)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalars(select(User).where(func.lower(User.email) == body.email.strip().lower())).first()
    ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if not (user and ok and user.is_active):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.of(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.of(user)
