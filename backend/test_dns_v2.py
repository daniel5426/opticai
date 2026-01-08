import os
import socket
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if db_url:
    print(f"DATABASE_URL length: {len(db_url)}")
    try:
        parsed = urlparse(db_url)
        print(f"Scheme: {parsed.scheme}")
        print(f"Username: {parsed.username}")
        print(f"Password: {'***' if parsed.password else 'None'}")
        print(f"Hostname: '{parsed.hostname}'")
        print(f"Port: {parsed.port}")
        print(f"Path: {parsed.path}")
        
        if parsed.hostname:
            print(f"Testing resolution for '{parsed.hostname}'...")
            try:
                addr = socket.gethostbyname(parsed.hostname)
                print(f"Resolved to: {addr}")
            except Exception as e:
                print(f"Resolution failed: {e}")
        else:
            print("No hostname found in URL.")
            
    except Exception as e:
        print(f"Failed to parse URL: {e}")
else:
    print("DATABASE_URL not found.")
