from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

from app.config import get_settings


class AuthedUser:
    def __init__(self, user_id: str, email: str | None, role: str | None):
        self.id = user_id
        self.email = email
        self.role = role


_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        url = f"{get_settings().supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(url, cache_keys=True, lifespan=3600)
    return _jwks_client


def _decode(token: str) -> dict:
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token_expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_token") from exc


def current_user(authorization: Annotated[str | None, Header()] = None) -> AuthedUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing_bearer_token")
    payload = _decode(authorization.split(" ", 1)[1])
    role = (payload.get("app_metadata") or {}).get("role")
    return AuthedUser(user_id=payload["sub"], email=payload.get("email"), role=role)


def require_admin(user: Annotated[AuthedUser, Depends(current_user)]) -> AuthedUser:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "admin_only")
    return user
