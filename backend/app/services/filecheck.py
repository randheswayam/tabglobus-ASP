"""Upload checks shared by site media and sign-off packages. The Content-Type header comes from the client,
so the file's own leading bytes are checked too, and reading stops as soon as the size limit is passed."""

from fastapi import HTTPException, UploadFile, status

_CHUNK = 1024 * 1024

EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "application/pdf": ".pdf",
}


def signature_matches(content_type: str, head: bytes) -> bool:
    return {
        "image/jpeg": head[:3] == b"\xff\xd8\xff",
        "image/png": head[:8] == b"\x89PNG\r\n\x1a\n",
        "image/webp": head[:4] == b"RIFF" and head[8:12] == b"WEBP",
        "video/mp4": head[4:8] == b"ftyp",
        "video/webm": head[:4] == b"\x1a\x45\xdf\xa3",
        "application/pdf": head[:5] == b"%PDF-",
    }.get(content_type, False)


def content_type_of(file: UploadFile) -> str:
    return (file.content_type or "").split(";")[0].strip().lower()


async def read_checked(file: UploadFile, content_type: str, limit_mb: int, what: str) -> bytes:
    """The whole file, or 413 past the limit, or 415 when its bytes don't match the declared type."""
    limit = limit_mb * 1024 * 1024
    data = bytearray()
    while chunk := await file.read(_CHUNK):
        data += chunk
        if len(data) > limit:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"A {what} can be at most {limit_mb} MB")
    if not signature_matches(content_type, bytes(data[:16])):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"The file is not a valid {content_type}")
    return bytes(data)
