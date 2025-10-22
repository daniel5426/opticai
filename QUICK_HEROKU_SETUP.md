# Quick Heroku Setup for Prysm

Since you're using Supabase for PostgreSQL, here's the streamlined setup:

## 1. Install Heroku CLI

```bash
# On macOS
brew tap heroku/brew && brew install heroku

# Or download from: https://devcenter.heroku.com/articles/heroku-cli
```

## 2. Create Heroku App

```bash
# Login to Heroku
heroku login

# Create app (this automatically adds the git remote)
heroku create prysm-backend

# Verify remote was added
git remote -v
# Should show:
# heroku  https://git.heroku.com/prysm-backend.git (fetch)
# heroku  https://git.heroku.com/prysm-backend.git (push)
```

## 3. Set Environment Variables

```bash
# Security
heroku config:set SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')" -a prysm-backend
heroku config:set ACCESS_TOKEN_EXPIRE_MINUTES=0 -a prysm-backend

# Database (from your Supabase dashboard)
heroku config:set DATABASE_URL="postgresql://postgres:[YOUR_PASSWORD]@[YOUR_HOST]:5432/postgres" -a prysm-backend

# OpenAI
heroku config:set OPENAI_API_KEY="your-openai-api-key" -a prysm-backend

# Supabase
heroku config:set SUPABASE_URL="your-supabase-url" -a prysm-backend
heroku config:set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" -a prysm-backend
heroku config:set SUPABASE_KEY="your-supabase-anon-key" -a prysm-backend
heroku config:set SUPABASE_JWT_SECRET="your-jwt-secret" -a prysm-backend
heroku config:set SUPABASE_BUCKET="opticai" -a prysm-backend

# CORS
heroku config:set BACKEND_CORS_ORIGINS="*" -a prysm-backend
```

## 4. Deploy Backend

```bash
# From the ROOT of your project (not inside backend/)
git subtree push --prefix backend heroku main
```

## 5. Verify Deployment

```bash
# Check logs
heroku logs --tail -a prysm-backend

# Test API
curl https://prysm-backend.herokuapp.com/api/v1/health
```

## 6. Update Frontend Configuration

Edit `.env.production`:
```env
VITE_API_URL=https://prysm-backend.herokuapp.com/api/v1
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_KEY=your-supabase-anon-key
```

## Getting Your Supabase Connection String

1. Go to your Supabase project dashboard
2. Settings → Database
3. Copy the "Connection string" under "Connection parameters"
4. It looks like: `postgresql://postgres:[password]@[host]:5432/postgres`
5. Use this as your `DATABASE_URL`

## Cost

- **Heroku Eco dyno**: $5/month
- **No database costs** (using Supabase)
- **Total**: $5/month

## Troubleshooting

**"No such ref: refs/heads/heroku" error:**
```bash
git subtree split --prefix backend -b backend-deploy
git push heroku backend-deploy:main
git branch -D backend-deploy
```

**Database connection issues:**
- Verify your Supabase database is running
- Check the connection string is correct
- Ensure SSL is enabled in your Supabase settings

**CORS errors:**
- Make sure `BACKEND_CORS_ORIGINS="*"` is set
- Check that your Electron app is making requests to the correct URL
