# Create Test Release (Manual Method)

If you don't have GitHub CLI installed, you can create a test release manually:

## Method 1: Using GitHub Web UI (Easiest)

1. **Download assets from last release:**
   - Go to: https://github.com/daniel5426/opticai/releases
   - Find the last release (e.g., v1.0.27)
   - Download all the files (ZIP files, YML files, etc.)

2. **Create new tag:**
   ```bash
   # Get current version
   CURRENT_VERSION=$(node -p "require('./package.json').version")
   NEW_VERSION="${CURRENT_VERSION%.*}.$((${CURRENT_VERSION##*.} + 1))"
   
   # Create and push tag
   git tag "v$NEW_VERSION"
   git push origin "v$NEW_VERSION"
   ```

3. **Create release on GitHub:**
   - Go to: https://github.com/daniel5426/opticai/releases/new
   - Select tag: `v$NEW_VERSION` (or the version you just created)
   - Title: `Release v$NEW_VERSION (Test Release)`
   - Description: `Test release with same files as v1.0.27`
   - Check "Set as a pre-release" if you want (optional)
   - Drag and drop all the downloaded files
   - Click "Publish release"

## Method 2: Using GitHub CLI (Automated)

```bash
./scripts/create-test-release.sh
```

This script will:
1. Ask for the last release tag to copy from
2. Download all assets from that release
3. Create a new tag with incremented version
4. Create a new draft release with the same files

## Method 3: Quick One-Liner (if you have gh CLI)

```bash
LAST_TAG="v1.0.27"  # Change this to your last release
NEW_VERSION="1.0.28"  # Change this to your new test version

# Download assets
mkdir -p /tmp/release-assets
cd /tmp/release-assets
gh release download "$LAST_TAG" --repo daniel5426/opticai

# Create tag and release
cd /path/to/opticai
git tag "v$NEW_VERSION"
git push origin "v$NEW_VERSION"

# Create release
cd /tmp/release-assets
gh release create "v$NEW_VERSION" \
    --repo daniel5426/opticai \
    --title "Release v$NEW_VERSION (Test)" \
    --notes "Test release" \
    --draft \
    *

rm -rf /tmp/release-assets
```

## Important Notes

- The `latest-mac.yml` and `latest.yml` files will need to be updated with the new version number for auto-updates to work
- You may need to manually edit these files before uploading, or the updater might not recognize it as a newer version
- For testing, you can keep the old version numbers in the YML files if you just want to test the download/install flow
