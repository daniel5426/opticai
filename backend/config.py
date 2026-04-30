import os
from pathlib import Path
from sqlalchemy.engine import make_url

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv(*args, **kwargs):
        return False

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()

if APP_ENV != "production":
    root_dir = Path(__file__).resolve().parent.parent
    load_dotenv(root_dir / ".env.development")
    load_dotenv(Path(__file__).resolve().parent / ".env")
    load_dotenv()


def _csv_env(name: str, default: str = "") -> list[str]:
    return [value.strip() for value in os.getenv(name, default).split(",") if value.strip()]


def _normalize_database_url(value: str) -> str:
    if value.startswith("postgres://"):
        return "postgresql://" + value.removeprefix("postgres://")
    return value

class Settings:
    PROJECT_NAME: str = "OpticAI API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    APP_ENV: str = APP_ENV
    
    # Database
    DATABASE_URL: str = _normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./opticai.db"))
    
    # OpenAI
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    TOKEN_ENCRYPTION_KEY: str = os.getenv("TOKEN_ENCRYPTION_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    
    # CORS
    BACKEND_CORS_ORIGINS: list = _csv_env(
        "BACKEND_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
    )
    ALLOW_WILDCARD_CORS_IN_PRODUCTION: bool = os.getenv(
        "ALLOW_WILDCARD_CORS_IN_PRODUCTION",
        "false",
    ).strip().lower() in {"1", "true", "yes"}
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    # Prefer service role for backend admin operations, fallback to legacy SUPABASE_KEY for backward compatibility
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_BUCKET: str = os.getenv("SUPABASE_BUCKET", "opticai")

    # Google OAuth
    GOOGLE_DESKTOP_CLIENT_ID: str = os.getenv("GOOGLE_DESKTOP_CLIENT_ID", "")
    GOOGLE_DESKTOP_CLIENT_SECRET: str = os.getenv("GOOGLE_DESKTOP_CLIENT_SECRET", "")

    # WhatsApp
    WHATSAPP_ACCESS_TOKEN: str = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    WHATSAPP_PHONE_NUMBER_ID: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_VERIFY_TOKEN: str = os.getenv("WHATSAPP_VERIFY_TOKEN", "opticai_verify_token")
    FB_APP_ID: str = os.getenv("FB_APP_ID", "")
    FB_APP_SECRET: str = os.getenv("FB_APP_SECRET", "")

    def validate(self) -> None:
        if self.APP_ENV != "production":
            return

        errors: list[str] = []
        if not os.getenv("DATABASE_URL"):
            errors.append("DATABASE_URL is required in production")
        else:
            backend_name = make_url(self.DATABASE_URL).get_backend_name()
            if backend_name == "sqlite":
                errors.append("DATABASE_URL must not use SQLite in production")

        if not self.SECRET_KEY or self.SECRET_KEY == "your-secret-key-here" or len(self.SECRET_KEY) < 32:
            errors.append("SECRET_KEY must be a real secret with at least 32 characters in production")

        if not self.TOKEN_ENCRYPTION_KEY or len(self.TOKEN_ENCRYPTION_KEY) < 32:
            errors.append("TOKEN_ENCRYPTION_KEY must be configured with at least 32 characters in production")

        if "*" in self.BACKEND_CORS_ORIGINS and not self.ALLOW_WILDCARD_CORS_IN_PRODUCTION:
            errors.append("Wildcard CORS is blocked in production unless ALLOW_WILDCARD_CORS_IN_PRODUCTION=true")

        required = {
            "SUPABASE_URL": self.SUPABASE_URL,
            "SUPABASE_SERVICE_ROLE_KEY": self.SUPABASE_SERVICE_ROLE_KEY,
            "SUPABASE_KEY": self.SUPABASE_KEY,
            "GOOGLE_DESKTOP_CLIENT_ID": self.GOOGLE_DESKTOP_CLIENT_ID,
            "GOOGLE_DESKTOP_CLIENT_SECRET": self.GOOGLE_DESKTOP_CLIENT_SECRET,
        }
        missing = [key for key, value in required.items() if not value]
        if missing:
            errors.append(f"Missing required production settings: {', '.join(missing)}")

        if errors:
            raise RuntimeError("Invalid production configuration: " + "; ".join(errors))


settings = Settings()
settings.validate()
