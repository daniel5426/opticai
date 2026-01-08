import os
import socket
from dotenv import load_dotenv

load_dotenv()

host = "aws-0-eu-central-1.pooler.supabase.com"
print(f"Testing resolution for {host}...")
try:
    addr = socket.gethostbyname(host)
    print(f"Resolved to: {addr}")
except Exception as e:
    print(f"Resolution failed: {e}")

db_url = os.getenv("DATABASE_URL")
if db_url:
    print(f"DATABASE_URL is set (length: {len(db_url)})")
    # Don't print the whole thing for security, but check the host part
    try:
        from urllib.parse import urlparse
        parsed = urlparse(db_url)
        print(f"Parsed host: '{parsed.hostname}'")
        if parsed.hostname:
            print(f"Testing resolution for parsed host '{parsed.hostname}'...")
            addr = socket.gethostbyname(parsed.hostname)
            print(f"Resolved to: {addr}")
    except Exception as e:
        print(f"Failed to parse or resolve DATABASE_URL host: {e}")
else:
    print("DATABASE_URL not found in environment.")
