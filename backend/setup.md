# OpticAI API Server Setup

## Prerequisites

1. Python 3.8 or higher
2. PostgreSQL database (Supabase recommended)
3. OpenAI API key

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create a `.env` file in the backend directory:
```
# Database
DATABASE_URL=postgresql://username:password@host:port/database_name

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Security
SECRET_KEY=your_secret_key_here

# Server
HOST=0.0.0.0
PORT=8001
```

3. Set up PostgreSQL database:
   - Create a new database
   - Run the application to create tables automatically
   - Or use the migration script to transfer existing SQLite data

4. Run the server:
```bash
python main.py
```

The server will start on `http://localhost:8001`

## Database Setup

### Option 1: Supabase (Recommended)
1. Create a new project on [Supabase](https://supabase.com)
2. Get your database connection string
3. Add it to your `.env` file as `DATABASE_URL`

### Option 2: Local PostgreSQL
1. Install PostgreSQL locally
2. Create a new database
3. Update the `DATABASE_URL` in your `.env` file

## Migration from SQLite

If you have existing SQLite data, use the migration script:

```bash
python migrate_sqlite_to_postgres.py
```

This will transfer your existing data to the PostgreSQL database.

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login with form data
- `POST /api/v1/auth/login-json` - Login with JSON
- `GET /api/v1/auth/me` - Get current user

### Companies
- `GET /api/v1/companies` - List companies
- `POST /api/v1/companies` - Create company
- `GET /api/v1/companies/{id}` - Get company
- `PUT /api/v1/companies/{id}` - Update company
- `DELETE /api/v1/companies/{id}` - Delete company

### Clinics
- `GET /api/v1/clinics` - List clinics
- `POST /api/v1/clinics` - Create clinic
- `GET /api/v1/clinics/{id}` - Get clinic
- `GET /api/v1/clinics/unique/{unique_id}` - Get clinic by unique ID
- `PUT /api/v1/clinics/{id}` - Update clinic
- `DELETE /api/v1/clinics/{id}` - Delete clinic

### Users
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/{id}` - Get user
- `GET /api/v1/users/username/{username}` - Get user by username
- `PUT /api/v1/users/{id}` - Update user
- `DELETE /api/v1/users/{id}` - Delete user

### OpenAI Chat
- `POST /chat/completions` - OpenAI chat completions proxy

### Health Check
- `GET /health` - Health check endpoint

## Configuration

- Server host: `0.0.0.0` (accessible from all network interfaces)
- Server port: `8001`
- API version: `v1`
- OpenAI model: `gpt-4o`

## Frontend Integration

The Electron app now uses the API client (`src/lib/api-client.ts`) to communicate with the backend instead of local SQLite operations.

## Security

- JWT-based authentication
- Role-based access control
- Password hashing with bcrypt
- CORS enabled for cross-origin requests

## Development

The backend is organized into:
- `config.py` - Configuration settings
- `database.py` - Database connection
- `models.py` - SQLAlchemy models
- `schemas.py` - Pydantic schemas
- `auth.py` - Authentication utilities
- `EndPoints/` - API endpoint modules
- `main.py` - FastAPI application 