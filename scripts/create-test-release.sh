#!/bin/bash

set -e

REPO="daniel5426/opticai"
CURRENT_VERSION=$(node -p "require('./package.json').version")
NEW_VERSION="${CURRENT_VERSION%.*}.$((${CURRENT_VERSION##*.} + 1))"

echo "Current version: $CURRENT_VERSION"
echo "New test version: $NEW_VERSION"
echo ""

read -p "Enter the tag of the last release to copy from (e.g., v1.0.27): " LAST_TAG

if [ -z "$LAST_TAG" ]; then
    echo "Error: Last tag is required"
    exit 1
fi

echo ""
echo "Creating test release v$NEW_VERSION with files from $LAST_TAG..."
echo ""

TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo "Downloading assets from $LAST_TAG..."
gh release download "$LAST_TAG" --repo "$REPO" --dir "$TEMP_DIR"

echo ""
echo "Creating new tag v$NEW_VERSION..."
cd - > /dev/null
git tag "v$NEW_VERSION"
git push origin "v$NEW_VERSION"

echo ""
echo "Updating YML files with new version..."
cd "$TEMP_DIR"

LAST_VERSION="${LAST_TAG#v}"

if [ -f "latest-mac.yml" ]; then
    echo "Updating latest-mac.yml..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/version: $LAST_VERSION/version: $NEW_VERSION/g" latest-mac.yml
        sed -i '' "s/version: \"$LAST_VERSION\"/version: \"$NEW_VERSION\"/g" latest-mac.yml
    else
        sed -i "s/version: $LAST_VERSION/version: $NEW_VERSION/g" latest-mac.yml
        sed -i "s/version: \"$LAST_VERSION\"/version: \"$NEW_VERSION\"/g" latest-mac.yml
    fi
fi

if [ -f "latest.yml" ]; then
    echo "Updating latest.yml..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/version: $LAST_VERSION/version: $NEW_VERSION/g" latest.yml
        sed -i '' "s/version: \"$LAST_VERSION\"/version: \"$NEW_VERSION\"/g" latest.yml
    else
        sed -i "s/version: $LAST_VERSION/version: $NEW_VERSION/g" latest.yml
        sed -i "s/version: \"$LAST_VERSION\"/version: \"$NEW_VERSION\"/g" latest.yml
    fi
fi

echo ""
echo "Creating new release with downloaded files..."
ASSETS=$(ls -1)
ASSET_FILES=""
for file in $ASSETS; do
    ASSET_FILES="$ASSET_FILES $file"
done

gh release create "v$NEW_VERSION" \
    --repo "$REPO" \
    --title "Release v$NEW_VERSION (Test Release)" \
    --notes "Test release with same files as $LAST_TAG

This is a test release created to test the update mechanism without rebuilding." \
    --draft \
    $ASSET_FILES

cd - > /dev/null
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Test release v$NEW_VERSION created as draft!"
echo "Go to https://github.com/$REPO/releases to publish it when ready."
