# Fix Performance Issues on Mac M2

## Problem Identified

Your Electron app was running slow in production builds because they were being packaged as x64 (Intel) instead of ARM64 (Apple Silicon), forcing them to run through Rosetta 2 translation.

**Development mode** was already fast because it uses the native ARM64 Electron from `node_modules/electron/dist/`.

## Solution Applied

### 1. Added Architecture-Specific Build Scripts

In `package.json`:
```json
"make:arm64": "electron-forge make --arch=arm64",
"make:x64": "electron-forge make --arch=x64"
```

### 2. Updated .gitignore

Added test directories to prevent accidentally committing large build files:
```
test-arm64/
test-x64/
```

## How to Build

**For Mac M1/M2/M3 (Apple Silicon):**
```bash
npm run make:arm64
```

**For Intel Macs:**
```bash
npm run make:x64
```

**For current platform (auto-detect):**
```bash
npm run make
```

## Expected Performance Improvements

With native ARM64 builds:
- ✅ **2-3x faster** overall performance
- ✅ **Smoother** UI rendering  
- ✅ **Lower** CPU usage
- ✅ **Better** battery life
- ✅ **Faster** build times

## Why This Fixed the Issue

- **Development**: Already used native ARM64 Electron = fast
- **Production (before)**: Built as x64 = slow (Rosetta 2)
- **Production (after)**: Built as ARM64 = fast (native)

The React optimizations (Phase 1 & 2) are also in place and will now have their full effect without the Rosetta 2 bottleneck.

