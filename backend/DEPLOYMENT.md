# Backend Deployment Guide (Heroku)

Last Updated: 2026-04-30

## Prerequisites

1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
2. Have a Heroku account
3. Have Supabase account with PostgreSQL database
4. Have OpenAI API key (for AI features)

## Initial Setup

### 1. Login to Heroku
```bash
heroku login
```

### 2. Create Heroku App
```bash
cd backend
heroku create your-app-name
```

Or use existing app:
```bash
heroku git:remote -a your-app-name
```

### 3. Configure Environment Variables

Set all required environment variables:

```bash
# Runtime
heroku config:set APP_ENV=production
heroku config:set SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
heroku config:set ACCESS_TOKEN_EXPIRE_MINUTES=0

# Database (Supabase PostgreSQL)
heroku config:set DATABASE_URL="postgresql://postgres:[password]@[host]:5432/[database]"

# OpenAI
heroku config:set OPENAI_API_KEY="your-openai-api-key"

# Supabase
heroku config:set SUPABASE_URL="your-supabase-url"
heroku config:set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
heroku config:set SUPABASE_KEY="your-supabase-anon-key"
heroku config:set SUPABASE_JWT_SECRET="your-jwt-secret"
heroku config:set SUPABASE_BUCKET="opticai"

# CORS - keep explicit unless you intentionally opt into wildcard
heroku config:set BACKEND_CORS_ORIGINS="app://.,http://localhost:5173,http://127.0.0.1:5173"
```

### 4. View All Config Variables
```bash
heroku config
```

## Deployment

### Understanding the Monorepo Setup

Since both backend (FastAPI) and frontend (Electron) are in the same repository, Heroku needs to know to deploy **only the backend directory**. We use **git subtree push** to achieve this.

### Deploy from Local Repository

**Method 1: Git Subtree Push (Recommended)**

This pushes only the `backend/` directory to Heroku as if it were the root:

```bash
# From the ROOT of your project (not inside backend/)
git subtree push --prefix backend heroku main
```

What this does:
- Extracts only the `backend/` folder
- Pushes it to Heroku as the root directory
- Heroku sees `Procfile`, `requirements.txt`, `main.py` at root level
- Heroku automatically detects it as a Python app

**Important Notes:**
- Run this from the **project root**, not from inside `backend/`
- First time may take a few minutes
- Subsequent deploys are faster

**Method 2: Separate Git Remote (Alternative)**

If you prefer a dedicated backend repository:

```bash
# Inside backend directory
cd backend
git init
git remote add heroku https://git.heroku.com/your-app.git
git add .
git commit -m "Initial backend deployment"
git push heroku master
```

### Troubleshooting Deployment

**Error: "No such ref: refs/heads/heroku"**
```bash
# First deployment, use this instead:
git subtree split --prefix backend -b backend-deploy
git push heroku backend-deploy:main
git branch -D backend-deploy
```

**Error: Updates were rejected**
```bash
# Force push (be careful!)
git push heroku `git subtree split --prefix backend main`:main --force
```

**Verify what Heroku sees:**
```bash
heroku run bash
ls -la  # Should show Procfile, main.py, etc. at root
```

## Post-Deployment

### 1. Backup Production Database
Before first clinic go-live or any migration, create a Supabase dashboard backup or run:
```bash
pg_dump "postgresql://postgres:[password]@[host]:5432/[database]" > backup-before-launch.sql
```

### 2. Run Safe Migrations
```bash
heroku run python scripts/safe_migrate.py -a your-app-name
```

The runner upgrades empty databases normally. For existing app databases without Alembic history, it verifies the model schema, stamps the baseline, then applies launch-safe schema guards.

### 3. Check Logs
```bash
heroku logs --tail
```

### 4. Test API
```bash
# Health check endpoint
curl https://your-app-name.herokuapp.com/health

# Or test login
curl https://your-app-name.herokuapp.com/api/v1/auth/login
```

### 5. Scale Dynos
```bash
# Ensure at least one web dyno is running
heroku ps:scale web=1
```

## Monitoring

### View App Status
```bash
heroku ps
```

### View Recent Logs
```bash
heroku logs -n 200
```

### Open App in Browser
```bash
heroku open
```

## Database Management

### Access Database Console
```bash
# Connect to your Supabase database
# Use the connection string from Supabase dashboard
psql "postgresql://postgres:[password]@[host]:5432/[database]"
```

### View Database Info
```bash
# Check your Supabase dashboard for database info
# Or use the connection string to connect directly
```

### Create Backup
```bash
# Use Supabase dashboard backup features
# Or create manual backup:
pg_dump "postgresql://postgres:[password]@[host]:5432/[database]" > backup.sql
```

## Troubleshooting

### Issue: Application Error
- Check logs: `heroku logs --tail`
- Verify all environment variables are set: `heroku config`
- Check dyno status: `heroku ps`

### Issue: Database Connection Error
- Verify DATABASE_URL points to your Supabase PostgreSQL
- Check Supabase database is running and accessible
- Ensure SSL mode is enabled for external connections

### Issue: CORS Errors
- Verify `BACKEND_CORS_ORIGINS` includes the actual packaged app/backend origin.
- Wildcard CORS is rejected in production unless `ALLOW_WILDCARD_CORS_IN_PRODUCTION=true`.
- Check that requests include proper headers

### Restart Application
```bash
heroku restart
```

## Updating the Application

### Deploy Latest Changes
```bash
git add .
git commit -m "Your commit message"
git subtree push --prefix backend heroku main
```

### Rollback to Previous Version
```bash
heroku releases
heroku rollback v123  # Replace with version number
```

## Cost Optimization

- **Eco Dynos**: $5/month, sleeps after 30 minutes of inactivity
- **Basic Dynos**: $7/month, never sleeps
- **No database costs** (using Supabase)
- Consider upgrading for production use

## Security Best Practices

1. **Never commit sensitive data** - Use environment variables
2. **Rotate SECRET_KEY** periodically
3. **Use strong passwords** for database
4. **Enable 2FA** on Heroku account
5. **Review access logs** regularly
6. **Keep dependencies updated** - Run `pip list --outdated`

## Production Checklist

- [ ] All environment variables set
- [ ] Database configured and migrations run
- [ ] CORS properly configured
- [ ] SECRET_KEY is strong and unique
- [ ] Logs reviewed for errors
- [ ] API endpoints tested
- [ ] SSL/HTTPS enabled (automatic on Heroku)
- [ ] Monitoring set up
- [ ] Backup strategy in place

## Additional Resources

- [Heroku Python Documentation](https://devcenter.heroku.com/articles/getting-started-with-python)
- [Supabase Documentation](https://supabase.com/docs)
- [FastAPI Deployment Guide](https://fastapi.tiangolo.com/deployment/)

## Environment Variables Reference

| Variable | Description | Required | Source |
|----------|-------------|----------|---------|
| `APP_ENV` | Runtime mode; set to `production` on Heroku | Yes | Heroku config |
| `DATABASE_URL` | Supabase PostgreSQL connection string | Yes | Supabase Dashboard → Settings → Database |
| `SECRET_KEY` | JWT signing secret | Yes | Generate with Python secrets module |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiration (0 = no expiry) | Yes | Set to 0 for development |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Yes | OpenAI Dashboard |
| `SUPABASE_URL` | Supabase project URL | Yes | Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes | Supabase Dashboard → Settings → API |
| `SUPABASE_KEY` | Supabase anon/public key | Yes | Supabase Dashboard → Settings → API |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret | Yes | Supabase Dashboard → Settings → API |
| `SUPABASE_BUCKET` | Storage bucket name | Yes | Set to "opticai" or your preferred name |
| `BACKEND_CORS_ORIGINS` | Allowed CORS origins | Yes | Explicit origins; avoid `*` in production |
| `ALLOW_WILDCARD_CORS_IN_PRODUCTION` | Emergency override for wildcard CORS | No | Defaults to false |

## Getting Your Supabase Connection String

1. Go to your Supabase project dashboard
2. Navigate to Settings → Database
3. Copy the "Connection string" under "Connection parameters"
4. It will look like: `postgresql://postgres:[password]@[host]:5432/postgres`
5. Use this as your `DATABASE_URL` in Heroku config
