"""Read-only owner discovery. Never grants ownership based on an email at login."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text
from database import engine, parsed_url

EMAILS = ("daniel.benassayag@agents24.dev", "danielbenassayag2626@gmail.com")


def main():
    print({"backend": parsed_url.get_backend_name(), "host": parsed_url.host,
           "database": parsed_url.database, "username": parsed_url.username})
    with engine.connect() as connection:
        with connection.begin():
            if parsed_url.get_backend_name() == "postgresql":
                connection.execute(text("SET TRANSACTION READ ONLY"))
            rows = connection.execute(text("SELECT id, email, is_active FROM users WHERE lower(trim(email)) IN (:first, :second)"),
                {"first": EMAILS[0], "second": EMAILS[1]}).mappings().all()
    for row in rows:
        print(dict(row))
    ids = [str(row["id"]) for row in rows if row["is_active"]]
    print("OWNER_USER_IDS=" + ",".join(ids))
    missing = set(EMAILS) - {row["email"].strip().lower() for row in rows}
    if missing:
        print("Accounts not found: " + ", ".join(sorted(missing)))


if __name__ == "__main__":
    main()
