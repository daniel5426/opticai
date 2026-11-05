import hashlib
import importlib.util
import json
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

spec = importlib.util.spec_from_file_location('candidate', Path(__file__).with_name('verify-desktop-candidate.py'))
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)


finder_spec = importlib.util.spec_from_file_location('finder', Path(__file__).with_name('find-desktop-candidate.py'))
finder = importlib.util.module_from_spec(finder_spec)
finder_spec.loader.exec_module(finder)


class ReleaseCheckoutBytes(unittest.TestCase):
    def test_receipt_inputs_keep_identical_bytes_on_windows(self):
        paths = ['package.json', 'package-lock.json', 'config/devdesk-release/package.json',
                 'config/devdesk-release/package-lock.json', 'config/devdesk-release/versions.json',
                 'config/desktop-runtime/package.json', 'config/desktop-runtime/package-lock.json',
                 'scripts/desktop-runtime.mjs']
        attributes = subprocess.check_output(['git', 'check-attr', 'eol', '--', *paths], text=True)
        self.assertEqual(len(attributes.splitlines()), len(paths))
        for line in attributes.splitlines():
            self.assertTrue(line.endswith(': eol: lf'), line)


class IndependentCandidates(unittest.TestCase):
    def test_selects_ready_platform_while_other_is_running_or_failed(self):
        for other_status in [None, 'failure']:
            with self.subTest(other_status=other_status), patch.object(finder, 'gh') as gh:
                gh.side_effect = [
                    [{'databaseId': 42}],
                    [{'jobs': [{'name': 'build-windows', 'conclusion': 'success'},
                               {'name': 'build-macos', 'conclusion': other_status}]}],
                    [{'artifacts': [{'name': 'windows-release', 'expired': False}]}],
                ]
                self.assertEqual(finder.find_candidate('owner/repo', 'a' * 40, 'windows'), 42)
                self.assertIn('a' * 40, gh.call_args_list[0].args)

    def test_failed_platform_never_uses_uploaded_artifacts(self):
        with patch.object(finder, 'gh') as gh:
            gh.side_effect = [[{'databaseId': 42}], [{'jobs': [{'name': 'build-macos', 'conclusion': 'failure'}]}]]
            self.assertIsNone(finder.find_candidate('owner/repo', 'a' * 40, 'macos'))
            self.assertEqual(gh.call_count, 2)

    def test_missing_or_expired_artifacts_block_only_their_platform(self):
        for artifacts in [[], [{'name': 'macos-release', 'expired': True}],
                          [{'name': 'windows-release', 'expired': False}]]:
            with self.subTest(artifacts=artifacts), patch.object(finder, 'gh') as gh:
                gh.side_effect = [[{'databaseId': 42}],
                                  [{'jobs': [{'name': 'build-macos', 'conclusion': 'success'}]}],
                                  [{'artifacts': artifacts}]]
                self.assertIsNone(finder.find_candidate('owner/repo', 'a' * 40, 'macos'))

    def test_finds_successful_job_and_artifact_on_later_pages(self):
        with patch.object(finder, 'gh') as gh:
            gh.side_effect = [[{'databaseId': 42}],
                              [{'jobs': []}, {'jobs': [{'name': 'build-macos', 'conclusion': 'success'}]}],
                              [{'artifacts': []}, {'artifacts': [{'name': 'macos-release', 'expired': False}]}]]
            self.assertEqual(finder.find_candidate('owner/repo', 'a' * 40, 'macos'), 42)


class CandidateIntegrity(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.sha = 'a' * 40
        self.version = '1.2.3'
        for folder, names in {
            'macos-release': ['Prysm-mac-arm64-1.2.3.zip', 'latest-mac.yml'],
            'windows-release': ['Prysm-Setup-1.2.3.exe', 'Prysm-Setup-1.2.3.exe.blockmap', 'latest.yml'],
        }.items():
            target = self.root / folder
            target.mkdir()
            files = {}
            for name in names:
                data = b'candidate bytes'
                (target / name).write_bytes(data)
                files[name] = {'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
            (target / 'candidate.json').write_text(json.dumps({'sha': self.sha, 'version': self.version, 'files': files}))

    def test_accepts_complete_exact_candidate(self):
        candidate.verify(self.root, self.sha, self.version)

    def test_verifies_each_platform_without_the_other(self):
        import shutil
        for platform, other in [('windows', 'macos'), ('macos', 'windows')]:
            with self.subTest(platform=platform):
                isolated = self.root / f'only-{platform}'
                isolated.mkdir()
                shutil.copytree(self.root / f'{platform}-release', isolated / f'{platform}-release')
                candidate.verify(isolated, self.sha, self.version, platform=platform)
                with self.assertRaises(ValueError):
                    candidate.verify(isolated, 'b' * 40, self.version, platform=platform)
                with self.assertRaises(ValueError):
                    candidate.verify(isolated, self.sha, self.version, platform=other)
                if platform == 'macos':
                    with self.assertRaises(ValueError):
                        candidate.verify(isolated, self.sha, self.version, include_macos=False, platform=platform)

    def test_windows_only_requires_explicit_selection(self):
        import shutil
        shutil.rmtree(self.root / 'macos-release')
        candidate.verify(self.root, self.sha, self.version, include_macos=False)
        with self.assertRaises(ValueError):
            candidate.verify(self.root, self.sha, self.version)

    def test_windows_only_rejects_unexpected_mac_artifacts(self):
        with self.assertRaises(ValueError):
            candidate.verify(self.root, self.sha, self.version, include_macos=False)

    def test_rejects_different_source_or_version(self):
        for sha, version in [('b' * 40, self.version), (self.sha, '1.2.4')]:
            with self.subTest(sha=sha, version=version), self.assertRaises(ValueError):
                candidate.verify(self.root, sha, version)

    def test_rejects_modified_package(self):
        (self.root / 'macos-release/Prysm-mac-arm64-1.2.3.zip').write_bytes(b'tampered bytes!!')
        with self.assertRaises(ValueError):
            candidate.verify(self.root, self.sha, self.version)

    def test_rejects_intel_artifact(self):
        receipt = self.root / 'macos-release/candidate.json'
        data = json.loads(receipt.read_text())
        data['files']['Prysm-mac-x64-1.2.3.zip'] = data['files'].pop('Prysm-mac-arm64-1.2.3.zip')
        receipt.write_text(json.dumps(data))
        with self.assertRaises(ValueError):
            candidate.verify(self.root, self.sha, self.version)

    def test_rejects_missing_windows_blockmap(self):
        (self.root / 'windows-release/Prysm-Setup-1.2.3.exe.blockmap').unlink()
        with self.assertRaises(FileNotFoundError):
            candidate.verify(self.root, self.sha, self.version)


if __name__ == '__main__':
    unittest.main()
