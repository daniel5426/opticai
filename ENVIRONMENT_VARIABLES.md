# Environment Variables in OpticAI

Last Updated: 2026-04-30

## Overview

The application handles environment variables differently in development vs production:

- **Development**: Uses ignored local env files based on `.env.example`
- **Production**: CI generates `.env.production` / `.env.windows.production` from GitHub Secrets before packaging

## How It Works

### Development Mode
```bash
npm run dev
```
- Loads `.env.development` first
- Falls back to `.env` if `.env.development` doesn't exist
- Environment variables are available to both main and renderer processes

### Production Build
```bash
npm run make
```
- The generated `.env.production` file is **packaged** as an extra resource
- Located at: `Prysm.app/Contents/Resources/.env.production`
- Loaded at runtime from `process.resourcesPath`

## Implementation Details

### Main Process (`src/main.ts`)
```typescript
if (process.env.NODE_ENV === 'production') {
  // Load .env.production from extraResources
  const envPath = path.join(process.resourcesPath, '.env.production');
  dotenv.config({ path: envPath });
} else {
  // Load .env.development in development
  dotenv.config({ path: '.env.development' });
  dotenv.config(); // Fallback to .env
}
```

### Renderer Process (`src/lib/api-client.ts`)
```typescript
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8001/api/v1';
```
- Vite injects `VITE_*` prefixed variables at build time
- These become hardcoded in the renderer bundle

### Packaging Configuration (`forge.config.ts`)
```typescript
packagerConfig: {
  extraResource: [
    ".env.production"  // Include .env.production in the app bundle
  ]
}
```

## Environment Variables Used

### Required Variables (`.env.production`)
```bash
# Backend API
VITE_API_URL='https://your-backend.herokuapp.com/api/v1'

# Google OAuth (Desktop - for Calendar/Email sync)
GOOGLE_DESKTOP_CLIENT_ID=your-desktop-client-id.apps.googleusercontent.com
GOOGLE_DESKTOP_CLIENT_SECRET=your-desktop-client-secret
```

## Important Notes

### 🔒 Security
- **Never commit** `.env`, `.env.*`, or backend secret files to git
- `.gitignore` blocks env files except `.env.example`
- Use `.env.example` as a template for other developers

### 🏗️ Build-Time vs Runtime

**Renderer Process (Vite)**:
- `VITE_*` variables are **embedded at build time**
- Values are hardcoded in the JavaScript bundle
- Cannot be changed after building without rebuilding

**Main Process (Electron)**:
- Variables are loaded at **runtime** from `.env.production`
- Can be changed by editing the file in the app bundle
- More secure for sensitive credentials

### 📦 Updating Production Config

To change environment variables in a packaged app:

1. **For end users**: You cannot change them without rebuilding
2. **For developers**:
   ```bash
   # Update GitHub Actions secrets or create a local ignored .env.production
   
   # Rebuild the app after regenerating env
   npm run dist:win
   ```

### 🔄 Different Environments

You can create different builds for different environments:

```bash
# Create an ignored .env.production from secrets or a secure local source

# Build
npm run dist:win

# The app will now use staging environment
```

## Troubleshooting

### App can't connect to backend
1. Check console logs: `Console.app` → search for "Loading production environment"
2. Verify `.env.production` exists in the app bundle:
   ```bash
   ls -la out/Prysm-darwin-x64/Prysm.app/Contents/Resources/.env.production
   ```
3. Check the API URL is correct in `.env.production`

### Google OAuth not working
1. Verify `GOOGLE_DESKTOP_CLIENT_ID` and `GOOGLE_DESKTOP_CLIENT_SECRET` are set
2. Check redirect URIs in Google Cloud Console match `http://localhost:*`
3. Enable Google Calendar API and Gmail API in Google Cloud Console

### Environment variables not loading
1. Check `NODE_ENV` is set correctly:
   - Development: `NODE_ENV=development`
   - Production: `NODE_ENV=production` (set automatically by forge)
2. Verify file paths in `src/main.ts`
3. Check console output for "Loading production environment from: [path]"

## Development Workflow

1. **Local Development**:
   ```bash
   # Use an ignored .env.development for local frontend/backend URLs
   echo "VITE_API_URL='http://localhost:8001/api/v1'" > .env.development
   npm run dev
   ```

2. **Testing Production Build**:
   ```bash
   # Use an ignored .env.production or CI-generated production env file
   echo "VITE_API_URL='https://your-backend.herokuapp.com/api/v1'" > .env.production
   npm run dist:win
   ```

3. **Distribution**:
   - Ensure GitHub Actions secrets produce the intended production values
   - Build and distribute the ZIP/DMG
   - Environment variables are embedded in the app

## Best Practices

1. ✅ **Always** use ignored env files for local development
2. ✅ **Always** generate production env files from secrets for release builds
3. ✅ **Never** hardcode sensitive credentials in source code
4. ✅ **Prefix** renderer variables with `VITE_`
5. ✅ **Test** production builds before distribution
6. ✅ **Document** required environment variables in `.env.example`
7. ❌ **Never** commit `.env*` files (except `.env.example`)
8. ❌ **Never** expose API keys in renderer process if avoidable

---

For more information, see:
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Electron Forge Packaging](https://www.electronforge.io/config/makers)
- [dotenv Documentation](https://github.com/motdotla/dotenv)
