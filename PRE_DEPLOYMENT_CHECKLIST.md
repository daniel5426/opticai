# Pre-Deployment Checklist

Use this checklist before deploying OpticAI for the first time.

## ⚙️ Configuration

### 1. Update Repository Information

- [ ] **package.json** - Update repository URL
  ```json
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR-USERNAME/opticai.git"
  }
  ```

- [ ] **forge.config.ts** - Update GitHub publisher settings
  ```typescript
  new PublisherGithub({
    repository: {
      owner: "YOUR-GITHUB-USERNAME",  // Change this
      name: "opticai",                // Change if repo name is different
    },
  })
  ```

### 2. Backend Deployment (Heroku)

- [ ] Create Heroku account (if not already)
- [ ] Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
- [ ] Create Heroku app: `heroku create your-app-name`
- [ ] Add PostgreSQL: `heroku addons:create heroku-postgresql:mini`
- [ ] Set environment variables (see below)
- [ ] Deploy backend: `git subtree push --prefix backend heroku main`
- [ ] Verify backend works: `curl https://your-app.herokuapp.com/api/v1/health`

#### Heroku Environment Variables

```bash
# Security
heroku config:set SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
heroku config:set ACCESS_TOKEN_EXPIRE_MINUTES=0

# OpenAI
heroku config:set OPENAI_API_KEY="your-openai-api-key"

# Supabase
heroku config:set DATABASE_URL='postgresql://postgres.eoyqvffwzllggemzfxaw:rDb&9w*$rGVt4#z@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
heroku config:set OPENAI_API_KEY=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
heroku config:set SECRET_KEY=ntBesFwAGgWI3T0Htx9hokScM-E2U_pvX2vT0qTA0uw
heroku config:set SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveXF2ZmZ3emxsZ2dlbXpmeGF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzk2MjA0MSwiZXhwIjoyMDY5NTM4MDQxfQ.PkBmwHTrdQz1Gpc5Mm_nfvSeDGxtiXQxosASvTYk69s'
heroku config:set SUPABASE_BUCKET='opticai'
heroku config:set SUPABASE_URL='https://eoyqvffwzllggemzfxaw.supabase.co'
heroku config:set SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveXF2ZmZ3emxsZ2dlbXpmeGF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzk2MjA0MSwiZXhwIjoyMDY5NTM4MDQxfQ.PkBmwHTrdQz1Gpc5Mm_nfvSeDGxtiXQxosASvTYk69s'
heroku config:set BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174
heroku config:set SUPABASE_JWT_SECRET='0JNwTlP0wZ44dF0H7uS+ckGeiC2C4IS/Q2CIL3n+nTniBV5hxo27cmeJn6sE401ubhVLcs6nN+LVIMT0JhgxRQ=='

# CORS
heroku config:set BACKEND_CORS_ORIGINS="*"
```

### 3. Frontend Configuration

- [ ] **Update .env.production** with your Heroku backend URL
  ```env
  VITE_API_URL=https://your-app-name.herokuapp.com/api/v1
  VITE_SUPABASE_URL=your-supabase-url
  VITE_SUPABASE_KEY=your-supabase-anon-key
  ```

- [ ] **Verify .env.development** for local development
  ```env
  VITE_API_URL=http://localhost:8001/api/v1
  ```

### 4. GitHub Setup

- [ ] Repository is on GitHub
- [ ] Create Personal Access Token:
  - Go to: Settings → Developer settings → Personal access tokens → Tokens (classic)
  - Click "Generate new token (classic)"
  - Name: "OpticAI Releases"
  - Scope: ✅ **repo** (full control)
  - Copy and save the token securely

- [ ] Add GitHub Secrets (for GitHub Actions):
  - Go to: Repository → Settings → Secrets and variables → Actions
  - Add New repository secret:
    - `VITE_API_URL`: Your Heroku URL (e.g., https://your-app.herokuapp.com/api/v1)
    - `VITE_SUPABASE_URL`: Your Supabase project URL
    - `VITE_SUPABASE_KEY`: Your Supabase anon key
  - Note: `GITHUB_TOKEN` is automatically provided

## 🧪 Testing

### Backend Testing

- [ ] Backend runs locally: `cd backend && uvicorn main:app --reload --port 8001`
- [ ] Database initialized: `python init_db.py` (if needed)
- [ ] API endpoints respond: `curl http://localhost:8001/api/v1/health`
- [ ] Backend deployed to Heroku successfully
- [ ] Heroku API responds: `curl https://your-app.herokuapp.com/api/v1/health`

### Frontend Testing

- [ ] App runs locally: `npm run dev`
- [ ] App connects to local backend successfully
- [ ] Test build locally: `npm run make`
- [ ] Installer created in `out/` directory
- [ ] Test installer on clean machine

## 📦 First Release

### Pre-Release

- [ ] All code committed to main branch
- [ ] Version in package.json is `1.0.0` (or your starting version)
- [ ] GitHub token set locally: `export GITHUB_TOKEN=your-token`
- [ ] Test build completed successfully

### Release Options

Choose **ONE** of the following methods:

#### Option A: Automated with GitHub Actions (Recommended)

- [ ] Push code to main: `git push origin main`
- [ ] Create tag: `git tag v1.0.0`
- [ ] Push tag: `git push origin v1.0.0`
- [ ] Monitor build: Go to GitHub → Actions tab
- [ ] Wait for build to complete (~5-10 minutes)
- [ ] Go to Releases tab and find draft release
- [ ] Add release notes
- [ ] Publish release

#### Option B: Manual Build

- [ ] Set GitHub token: `export GITHUB_TOKEN=your-token`
- [ ] Build and publish: `npm run publish`
- [ ] Wait for build to complete
- [ ] Tag the release:
  ```bash
  git add package.json
  git commit -m "Release v1.0.0"
  git tag v1.0.0
  git push origin main v1.0.0
  ```
- [ ] Go to GitHub Releases tab
- [ ] Find the draft release
- [ ] Add release notes
- [ ] Publish release

## ✅ Post-Deployment Verification

### After First Release

- [ ] Release is published (not draft) on GitHub
- [ ] Installer files are attached to the release
- [ ] Download installer from GitHub Release
- [ ] Install on a test Windows machine
- [ ] App launches successfully
- [ ] App connects to Heroku backend
- [ ] Can log in and use basic features
- [ ] Check DevTools console for errors (Ctrl+Shift+I)

### Auto-Update Testing

- [ ] Create a second release (v1.0.1):
  - Update version in package.json
  - Make a small change
  - Build and publish new version
- [ ] Open the v1.0.0 installed app
- [ ] Wait ~10 seconds after app opens
- [ ] Check if update notification appears (in Hebrew)
- [ ] Accept the update
- [ ] Verify update downloads
- [ ] Verify update installs and app restarts
- [ ] Confirm app is now v1.0.1

## 🚨 Common Issues

### "GitHub token not found" error
```bash
# Set the token in your terminal
export GITHUB_TOKEN=your-github-token

# Or on Windows PowerShell
$env:GITHUB_TOKEN="your-github-token"
```

### "Repository not found" error
- Check `package.json` repository field matches your GitHub repo
- Check `forge.config.ts` publisher configuration
- Verify GitHub token has `repo` scope

### Backend connection errors
- Verify `.env.production` has correct Heroku URL
- Test backend: `curl https://your-app.herokuapp.com/api/v1/health`
- Check Heroku logs: `heroku logs --tail`

### Build fails
- Ensure all dependencies installed: `npm ci`
- Check Node.js version: `node -v` (should be 20+)
- Try clean build: `rm -rf out/ node_modules/ && npm install && npm run make`

### Windows SmartScreen warning
- This is normal without code signing
- Click "More info" → "Run anyway"
- For production, consider purchasing code signing certificate

## 📚 Resources

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [RELEASE_GUIDE.md](./RELEASE_GUIDE.md) - Quick release reference
- [DEPLOYMENT_SETUP_COMPLETE.md](./DEPLOYMENT_SETUP_COMPLETE.md) - What was configured

## 💰 Expected Costs

**Minimum:**
- Heroku Eco dyno: $5/month
- Heroku Mini Postgres: $5/month
- GitHub: Free (public repo)
- **Total: ~$10/month**

**Optional:**
- Code signing certificate: ~$100-500/year
- GitHub private repo: $4/month
- Upgraded Heroku resources: $7-25+/month

## 🎉 Ready to Deploy?

Once all checkboxes are complete, you're ready to deploy!

**First-time deployment estimated time:**
- Backend setup: 20-30 minutes
- Frontend configuration: 10-15 minutes
- First release: 10-20 minutes
- Testing: 15-30 minutes
- **Total: 1-2 hours**

**Subsequent releases:**
- 5-10 minutes (mostly automated)

---

**Need Help?** Check the troubleshooting sections in DEPLOYMENT.md or open an issue on GitHub.

