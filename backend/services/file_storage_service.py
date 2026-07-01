import logging
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from fastapi import HTTPException
import requests
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

    def upload_path(self, bucket: str, key: str, path: Path, content_type: str) -> None:
        try:
            self.client.storage.from_(bucket).upload(
                file=path,
                path=key,
                file_options={"content-type": content_type, "upsert": "false"},
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Supabase file upload failed bucket=%s key=%s", bucket, key)
            raise HTTPException(status_code=502, detail=f"Storage upload failed: {exc}") from exc

    def download_to_path(self, bucket: str, key: str, path: Path) -> None:
        try:
            data = self.client.storage.from_(bucket).download(key)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Supabase file download failed bucket=%s key=%s", bucket, key)
            raise HTTPException(status_code=502, detail=f"Storage download failed: {exc}") from exc

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

    def create_signed_upload_url(self, bucket: str, key: str) -> str:
        try:
            storage = self.client.storage.from_(bucket)
            create_upload_url = getattr(storage, "create_signed_upload_url", None)
            if not callable(create_upload_url):
                raise RuntimeError("Supabase client does not support signed upload URLs")
            response = create_upload_url(key)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Supabase signed upload URL failed bucket=%s key=%s", bucket, key)
            raise HTTPException(status_code=502, detail=f"Failed to create signed upload URL: {exc}") from exc

        url = self._extract_signed_upload_url(response)
        if not url:
            raise HTTPException(status_code=502, detail="Storage did not return a signed upload URL")
        return url

    def exists(self, bucket: str, key: str) -> bool:
        supabase_url = getattr(config.settings, "SUPABASE_URL", None)
        service_role_key = getattr(config.settings, "SUPABASE_SERVICE_ROLE_KEY", None)
        if not supabase_url or not service_role_key:
            raise HTTPException(status_code=500, detail="Supabase storage configuration missing")

        encoded_key = quote(key, safe="/")
        url = f"{supabase_url.rstrip('/')}/storage/v1/object/{quote(bucket, safe='')}/{encoded_key}"
        try:
            response = requests.head(
                url,
                headers={
                    "Authorization": f"Bearer {service_role_key}",
                    "apikey": service_role_key,
                },
                timeout=20,
            )
        except requests.RequestException as exc:
            logger.exception("Supabase file exists check failed bucket=%s key=%s", bucket, key)
            raise HTTPException(status_code=502, detail=f"Storage exists check failed: {exc}") from exc

        if response.status_code == 404:
            return False
        if 200 <= response.status_code < 300:
            return True
        raise HTTPException(status_code=502, detail=f"Storage exists check failed ({response.status_code})")

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

    @staticmethod
    def _extract_signed_upload_url(response) -> Optional[str]:
        if not isinstance(response, dict):
            return str(response) if response else None
        data = response.get("data") or response
        url = (
            data.get("signed_url")
            or data.get("signedUrl")
            or data.get("signedURL")
            or data.get("signedUploadUrl")
            or data.get("url")
        )
        if url and str(url).startswith("/"):
            supabase_url = getattr(config.settings, "SUPABASE_URL", "")
            return f"{supabase_url.rstrip('/')}{url}"
        return url


def get_file_storage_service() -> FileStorageService:
    return FileStorageService()
