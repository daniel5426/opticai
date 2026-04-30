import logging
from typing import Optional

from fastapi import HTTPException
from supabase import create_client

import config

logger = logging.getLogger(__name__)


class FileStorageService:
    def __init__(self):
        supabase_url = getattr(config.settings, "SUPABASE_URL", None)
        service_role_key = getattr(config.settings, "SUPABASE_SERVICE_ROLE_KEY", None)
        if not supabase_url or not service_role_key:
            raise HTTPException(status_code=500, detail="Supabase storage configuration missing")
        self.client = create_client(supabase_url, service_role_key)

    def upload(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        try:
            self.client.storage.from_(bucket).upload(
                file=data,
                path=key,
                file_options={"content-type": content_type, "upsert": "false"},
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Supabase file upload failed bucket=%s key=%s", bucket, key)
            raise HTTPException(status_code=502, detail=f"Storage upload failed: {exc}") from exc

    def remove(self, bucket: str, key: str) -> None:
        try:
            self.client.storage.from_(bucket).remove([key])
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Supabase file delete failed bucket=%s key=%s", bucket, key)
            raise HTTPException(status_code=502, detail=f"Storage delete failed: {exc}") from exc

    def create_signed_url(self, bucket: str, key: str, expires_in: int = 3600) -> str:
        try:
            response = self.client.storage.from_(bucket).create_signed_url(key, expires_in)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Supabase signed URL failed bucket=%s key=%s", bucket, key)
            raise HTTPException(status_code=502, detail=f"Failed to create signed URL: {exc}") from exc

        url = self._extract_signed_url(response)
        if not url:
            raise HTTPException(status_code=502, detail="Storage did not return a signed URL")
        return url

    @staticmethod
    def _extract_signed_url(response) -> Optional[str]:
        if not isinstance(response, dict):
            return str(response) if response else None
        data = response.get("data") or response
        return (
            data.get("signed_url")
            or data.get("signedUrl")
            or data.get("signedURL")
            or data.get("publicUrl")
        )


def get_file_storage_service() -> FileStorageService:
    return FileStorageService()
