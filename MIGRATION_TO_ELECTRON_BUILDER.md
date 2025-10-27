# Migration to electron-builder Complete! 🎉

This document outlines the migration from Electron Forge to electron-builder for better auto-update support.

## What Changed

### 1. Build System
- **Before**: Electron Forge with `@electron-forge` packages
- **After**: electron-builder with `vite-plugin-electron`

### 2. Configuration Files
- **Removed**: `forge.config.ts`, `forge.env.d.ts`
- **Added**: `vite.config.ts` (unified config), `build/entitlements.mac.plist`
- **Updated**: `package.json` (now includes `build` section for electron-builder)

### 3. Build Output
- **Before**: `out/` directory (Electron Forge)
- **After**: `release/` directory (electron-builder)
- **Renderer**: `dist/` directory
- **Main/Preload**: `dist-electron/` directory

### 4. Auto-Update Files
electron-builder automatically generates these crucial files:
- `latest-mac.yml` - macOS update manifest
- `latest.yml` - Windows update manifest
- These files are now properly included in GitHub releases

### 5. Scripts Updated

#### Development
```bash
npm run dev          # Start development server (Vite + Electron)
npm run start        # Same as dev
```

#### Building
```bash
npm run build              # Build without packaging (for testing)
npm run build:mac          # Build for macOS (both architectures)
npm run build:mac:arm64    # Build for macOS Apple Silicon
npm run build:mac:x64      # Build for macOS Intel
npm run build:win          # Build for Windows
npm run build:linux        # Build for Linux
```

#### Distribution (with installers)
```bash
npm run dist         # Build and package for current platform
npm run dist:mac     # Build and package for macOS
npm run dist:win     # Build and package for Windows
npm run dist:linux   # Build and package for Linux
```

## How to Use

### Local Development
```bash
npm install          # Install updated dependencies
npm run dev          # Start development
```

### Building Locally
```bash
# For your current platform
npm run dist

# For specific platform
npm run dist:mac     # macOS (both arm64 and x64)
npm run dist:win     # Windows
npm run dist:linux   # Linux
```

### Creating a Release

1. **Update version** in `package.json`:
   ```json
   "version": "1.0.9"
   ```

2. **Commit and tag**:
   ```bash
   git add .
   git commit -m "Release v1.0.9"
   git tag v1.0.9
   git push origin main
   git push origin v1.0.9
   ```

3. **GitHub Actions** will automatically:
   - Build for macOS (arm64 and x64)
   - Build for Windows
   - Generate update manifest files (`latest-mac.yml`, `latest.yml`)
   - Create a GitHub release with all artifacts
   - Publish the release (making updates available)

## Auto-Update Flow

1. **User opens app** → App checks for updates in background
2. **Update found** → Notification appears in About tab
3. **User clicks "Download Update"** → Update downloads
4. **User clicks "Install Now"** → App quits and installs update
5. **App relaunches** → User is on the new version

## Build Output Structure

```
release/
├── Prysm-darwin-arm64-1.0.9.zip      # macOS Apple Silicon
├── Prysm-darwin-x64-1.0.9.zip        # macOS Intel
├── Prysm-Setup-1.0.9.exe             # Windows installer
├── latest-mac.yml                     # macOS update manifest
└── latest.yml                         # Windows update manifest
```

## Troubleshooting

### "Cannot find module" errors
Make sure you've run `npm install` after the migration.

### Build fails with memory errors
The GitHub workflow includes `NODE_OPTIONS: --max-old-space-size=4096`

### Auto-update not working
1. Check that `latest-mac.yml` or `latest.yml` exists in the GitHub release
2. Verify the app is running a production build (not dev)
3. Check the console logs for auto-updater messages

### macOS "damaged" error
Users should run: `xattr -cr /Applications/Prysm.app`

## Benefits of electron-builder

✅ **Proper auto-update support** with standard manifest files  
✅ **Better build performance** with Vite integration  
✅ **Smaller bundle sizes** with optimized packaging  
✅ **Industry standard** - used by most Electron apps  
✅ **Better documentation** and community support  

## Next Steps

1. **Test locally**: Run `npm run dist` and test the packaged app
2. **Create a test release**: Tag and push to trigger GitHub Actions
3. **Verify auto-update**: Download the release build and check for updates
4. **Remove old Forge deps**: Run `npm uninstall @electron-forge/plugin-auto-unpack-natives @electron-forge/shared-types`

## Files Modified

- `package.json` - Updated scripts and added build config
- `vite.config.ts` - New unified Vite config with electron plugin
- `src/main.ts` - Removed Forge reference
- `.github/workflows/release.yml` - Updated to use electron-builder
- `app-update.yml` - Simplified configuration
- `.gitignore` - Added electron-builder output directories

## Files Created

- `vite.config.ts` - Main Vite configuration
- `build/entitlements.mac.plist` - macOS entitlements

## Files Removed

- `forge.config.ts` - Electron Forge configuration
- `forge.env.d.ts` - Forge type definitions
- `vite.main.config.ts` - Replaced by unified config
- `vite.preload.config.ts` - Replaced by unified config
- `vite.renderer.config.mts` - Replaced by unified config

---

**Migration completed**: Ready to build and release with proper auto-update support! 🚀

