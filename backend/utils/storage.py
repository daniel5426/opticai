from uuid import uuid4
import base64
import re
from supabase import create_client
import config

def get_supabase_client():
    supabase_url = getattr(config.settings, 'SUPABASE_URL', None)
    supabase_key = getattr(config.settings, 'SUPABASE_KEY', None) or getattr(config.settings, 'SUPABASE_ANON_KEY', None)
    if not supabase_url or not supabase_key:
        raise Exception("Supabase configuration missing")
    return create_client(supabase_url, supabase_key)

def upload_base64_image(base64_input: str, path_prefix: str) -> str:
    if not base64_input:
        return base64_input
    if isinstance(base64_input, str) and base64_input.lower().startswith(('http://', 'https://')):
        return base64_input
    if isinstance(base64_input, str) and (
        base64_input.startswith('/storage/') or
        base64_input.startswith('storage/') or
        '/storage/v1/object/' in base64_input
    ):
        return base64_input
    # Heuristic: if it looks like a path (contains '/') and a common image extension, treat as existing path
    if isinstance(base64_input, str) and '/' in base64_input and any(base64_input.lower().endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg')):
        return base64_input
    mime = 'image/png'
    data_str = base64_input
    m = re.match(r"^data:([^;]+);base64,(.*)$", base64_input)
    if m:
        mime = m.group(1) or mime
        data_str = m.group(2) or ''
    try:
        file_bytes = base64.b64decode(data_str)
    except Exception:
        file_bytes = base64.b64decode(base64_input)
    ext = 'png'
    if '/' in mime:
        ext = mime.split('/')[-1] or 'png'
    unique_name = f"{uuid4().hex}.{ext}"
    storage_path = f"{path_prefix}/{unique_name}"
    bucket = getattr(config.settings, 'SUPABASE_BUCKET', None) or 'opticai'
    sb = get_supabase_client()
    sb.storage.from_(bucket).upload(file=file_bytes, path=storage_path, file_options={"content-type": mime})
    public_url_resp = sb.storage.from_(bucket).get_public_url(storage_path)
    if isinstance(public_url_resp, dict):
        data = public_url_resp.get('data') or {}
        url = data.get('publicUrl') or data.get('public_url')
        if url:
            return url
    try:
        signed = sb.storage.from_(bucket).create_signed_url(storage_path, 31536000)
        if isinstance(signed, dict):
            d = signed.get('data') or signed
            url = d.get('signed_url') or d.get('signedUrl') or d.get('publicUrl')
            if url:
                return url
        return str(signed)
    except Exception:
        return str(public_url_resp)


