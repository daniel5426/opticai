"""Verify downloaded candidate receipts before publication; uses Python stdlib only."""
import hashlib
import json
import os
import sys
from pathlib import Path


def verify(root, sha, version, include_macos=True, platform=None):
    expected = {
        "macos-release": {f"Prysm-mac-arm64-{version}.zip", "latest-mac.yml"},
        "windows-release": {f"Prysm-Setup-{version}.exe", f"Prysm-Setup-{version}.exe.blockmap", "latest.yml"},
    }
    if not include_macos:
        del expected["macos-release"]
    if platform is not None:
        folder = {"windows": "windows-release", "macos": "macos-release"}.get(platform)
        if folder not in expected:
            raise ValueError("Desktop platform is unknown or excluded for this version")
        expected = {folder: expected[folder]}
    if {folder.name for folder in root.iterdir() if folder.is_dir()} != set(expected):
        raise ValueError("Unexpected or missing candidate platform")
    for platform, names in expected.items():
        folder = root / platform
        receipt = json.loads((folder / "candidate.json").read_text())
        if receipt["sha"] != sha or receipt["version"] != version:
            raise ValueError("Candidate SHA/version mismatch")
        if set(receipt["files"]) != names:
            raise ValueError("Unexpected candidate file set")
        for name, evidence in receipt["files"].items():
            file = folder / name
            with file.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            if file.stat().st_size != evidence["size"] or digest != evidence["sha256"]:
                raise ValueError(f"Candidate integrity mismatch: {name}")
    print("Exact-SHA selected desktop candidate integrity verified")


if __name__ == "__main__":
    version = os.environ["RELEASE_VERSION"]
    policy = json.loads(Path("config/release-targets.json").read_text())
    skipped = policy["skipMacForVersions"]
    if not isinstance(skipped, list) or any(not isinstance(value, str) for value in skipped):
        raise ValueError("Invalid desktop release targets")
    verify(Path(sys.argv[1]), os.environ["RELEASE_SHA"], version, version not in skipped,
           platform=sys.argv[2] if len(sys.argv) > 2 else None)
