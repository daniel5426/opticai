"""Offline tests: no Railway calls or real secrets."""
import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock
from scripts.prepare_calendar_production_env import prepare, PROJECT

ENV={'CALENDAR_RELEASE_ENVIRONMENT':'production','GOOGLE_DESKTOP_CLIENT_ID':'client-marker','GOOGLE_DESKTOP_CLIENT_SECRET':'secret-marker'}
def result(value):return SimpleNamespace(returncode=0,stdout=json.dumps(value))


class CalendarProductionEnvTests(unittest.TestCase):
    def test_requires_explicit_release_context_before_any_cli_call(self):
        run=Mock()
        with self.assertRaises(RuntimeError):prepare(apply=True,env={},run=run)
        run.assert_not_called()

    def test_rejects_another_project_or_client_without_mutation(self):
        for replies in [[result({'id':'other'})],[result({'id':PROJECT}),result({'GOOGLE_DESKTOP_CLIENT_ID':'other'})]]:
            run=Mock(side_effect=replies)
            with self.assertRaises(RuntimeError):prepare(apply=True,env=ENV,run=run)
            self.assertFalse(any('set' in c.args[0] for c in run.call_args_list))

    def test_matching_secret_does_not_mutate_or_redeploy(self):
        run=Mock(side_effect=[result({'id':PROJECT}),result(ENV)])
        self.assertIn('already match',prepare(apply=True,env=ENV,run=run))
        self.assertEqual(run.call_count,2)

    def test_audit_is_read_only(self):
        run=Mock(side_effect=[result({'id':PROJECT}),result({'GOOGLE_DESKTOP_CLIENT_ID':'client-marker'})])
        self.assertIn('needs',prepare(env=ENV,run=run))
        self.assertEqual(run.call_count,2)

    def test_apply_uses_stdin_and_skip_deploys_then_verifies(self):
        run=Mock(side_effect=[result({'id':PROJECT}),result({'GOOGLE_DESKTOP_CLIENT_ID':'client-marker'}),result({}),result(ENV)])
        self.assertIn('prepared',prepare(apply=True,env=ENV,run=run))
        write=run.call_args_list[2]
        self.assertIn('--stdin',write.args[0]);self.assertIn('--skip-deploys',write.args[0])
        self.assertNotIn('secret-marker',write.args[0]);self.assertEqual(write.kwargs['input'],'secret-marker')
        self.assertEqual(run.call_count,4)


if __name__=='__main__':unittest.main()
