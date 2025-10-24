# How to Release a New Version

## Quick Release (3 commands)

```bash
# 1. Bump version
npm version patch    # 1.0.1 → 1.0.2
# OR
npm version minor    # 1.0.1 → 1.1.0  
# OR
npm version major    # 1.0.1 → 2.0.0

# 2. Push to GitHub
git push origin main && git push origin --tags

# 3. Wait ~15 minutes, then publish on GitHub!
```

## What Happens Automatically

1. ✅ **GitHub Actions builds** for all platforms:
   - macOS Apple Silicon (M1/M2/M3)
   - macOS Intel
   - Windows
   - Linux (DEB & RPM)

2. ✅ **Creates draft release** with all files attached

3. ✅ **Generates release notes** automatically

## Publishing the Release

1. Go to: https://github.com/daniel5426/opticai/releases
2. Find the **draft release** (e.g., "Release v1.0.2")
3. Review the attached files and release notes
4. Click **"Publish release"**

## Monitoring the Build

- **Actions**: https://github.com/daniel5426/opticai/actions
- **Releases**: https://github.com/daniel5426/opticai/releases

Build takes ~10-15 minutes.

## Version Types

- **`patch`**: Bug fixes (1.0.1 → 1.0.2)
- **`minor`**: New features (1.0.1 → 1.1.0)  
- **`major`**: Breaking changes (1.0.1 → 2.0.0)

## Local Testing (Optional)

Before releasing, test locally:

```bash
# Test ARM64 build (M1/M2 Macs)
npm run make:arm64

# Test x64 build (Intel Macs)
npm run make:x64

# Clean up
rm -rf test-arm64 test-x64
```

## Troubleshooting

**Build fails?**
- Check Actions tab for error logs
- Common: Missing dependencies, Node version issues

**Release not created?**
- Ensure tag starts with `v` (e.g., `v1.0.2`)
- Push both commits AND tags

**Wrong architecture?**
- Use `make:arm64` for Apple Silicon
- Use `make:x64` for Intel Macs

---

That's it! 🚀 Your app will be automatically built and ready for distribution.
