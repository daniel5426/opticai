# GitHub Actions Automated Release Process

This project uses GitHub Actions to automatically build and publish releases for all platforms.

## Quick Start

```bash
# 1. Bump version
npm version patch  # or minor/major

# 2. Push to trigger build
git push origin main && git push origin --tags

# 3. Wait ~15 minutes, then publish on GitHub!
```

## How It Works

When you push a tag (e.g., `v1.0.2`), GitHub Actions automatically:
1. ✅ Builds for **macOS ARM64** (M1/M2/M3)
2. ✅ Builds for **macOS x64** (Intel)
3. ✅ Builds for **Windows x64**
4. ✅ Builds for **Linux** (DEB and RPM)
5. ✅ Creates a **Draft Release** with all artifacts
6. ✅ Generates **release notes** automatically

## Build Artifacts

Each release includes:
- **Prysm-darwin-arm64-{version}.zip** - macOS Apple Silicon
- **Prysm-darwin-x64-{version}.zip** - macOS Intel
- **Prysm-Setup-{version}.exe** - Windows installer
- **prysm_{version}_amd64.deb** - Debian/Ubuntu
- **prysm-{version}.x86_64.rpm** - Fedora/RHEL

## Monitoring Builds

1. Go to **Actions** tab: https://github.com/daniel5426/opticai/actions
2. Watch "Release Build" workflow progress
3. Builds take approximately 10-15 minutes

## Publishing

1. Go to **Releases**: https://github.com/daniel5426/opticai/releases
2. Find the draft release
3. Review artifacts and release notes
4. Click **"Publish release"**

## Local Testing

Before creating a release, test locally:

```bash
# Test ARM64 build
npm run make:arm64
cd test-arm64 && unzip ../out/make/zip/darwin/arm64/Prysm-darwin-arm64-*.zip && open Prysm.app

# Test x64 build
npm run make:x64
cd test-x64 && unzip ../out/make/zip/darwin/x64/Prysm-darwin-x64-*.zip && open Prysm.app

# Clean up
rm -rf test-arm64 test-x64
```

## Troubleshooting

**Build fails:**
- Check Actions tab for logs
- Verify all dependencies in package.json
- Check Node version compatibility

**Release not created:**
- Ensure tag starts with `v` (e.g., `v1.0.2`)
- Push both commits and tags

**Wrong architecture:**
- Use `make:arm64` for Apple Silicon
- Use `make:x64` for Intel Macs

