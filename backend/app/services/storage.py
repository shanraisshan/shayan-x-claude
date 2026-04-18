import mimetypes
import secrets
from pathlib import PurePosixPath

from fastapi import HTTPException, UploadFile, status

from app.supabase_client import get_supabase

BUCKET = "product-images"
ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB


def upload_product_image(file: UploadFile) -> str:
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if content_type not in ALLOWED:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "unsupported_image_type")

    data = file.file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "image_too_large")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "empty_file")

    ext = PurePosixPath(file.filename or "").suffix.lower() or ".bin"
    key = f"{secrets.token_urlsafe(16)}{ext}"

    sb = get_supabase()
    sb.storage.from_(BUCKET).upload(
        key, data, file_options={"content-type": content_type, "upsert": "false"}
    )
    return sb.storage.from_(BUCKET).get_public_url(key)
