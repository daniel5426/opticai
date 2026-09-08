#!/usr/bin/env bash

set -euo pipefail

downloads_dir="${HOME}/Downloads"
run_root="${downloads_dir}/Prysm-runs"

latest_archive="$({
  find "$downloads_dir" -maxdepth 1 -type f -iname 'Prysm-mac-*.zip' -print0 |
    while IFS= read -r -d '' archive; do
      printf '%s\t%s\n' "$(stat -f '%m' "$archive")" "$archive"
    done
} | sort -rn | head -n 1 | cut -f2-)"

if [[ -z "$latest_archive" ]]; then
  echo "No Prysm macOS ZIP was found in $downloads_dir." >&2
  exit 1
fi

if ! unzip -Z1 "$latest_archive" | grep -qx 'Prysm.app/'; then
  echo "The latest Prysm download does not contain Prysm.app: $latest_archive" >&2
  exit 1
fi

archive_name="$(basename "${latest_archive%.zip}")"
release_dir="${run_root}/${archive_name}"
app_path="${release_dir}/Prysm.app"

if [[ ! -d "$app_path" ]]; then
  mkdir -p "$release_dir"
  unzip -q "$latest_archive" -d "$release_dir"
fi

xattr -dr com.apple.quarantine "$app_path" 2>/dev/null || true
open -n "$app_path"

echo "Opened: $app_path"
