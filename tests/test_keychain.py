import contextlib
import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('pilot_keychain', Path(__file__).resolve().parents[1] / 'scripts/keychain.py')
keychain = importlib.util.module_from_spec(spec)
spec.loader.exec_module(keychain)


class KeychainTests(unittest.TestCase):
    def call(self, action, store):
        output = io.StringIO()
        with patch.object(keychain, 'MacKeychain', return_value=store), contextlib.redirect_stdout(output):
            result = keychain.main([action])
        return result, output.getvalue()

    def test_rejects_invalid_keys(self):
        for value in [None, '', '   ', 'a\nb', '\rb', 'a b', 'a\x00b', 'a'*4097]:
            self.assertFalse(keychain.valid_key(value))
        self.assertTrue(keychain.valid_key('  synthetic-value  '))

    def test_status_never_prints_key(self):
        class Store:
            def read(self): return 'synthetic-private-value'
        _, output = self.call('status', Store())
        self.assertEqual(json.loads(output), {'state':'present'})

    def test_only_internal_ipc_can_return_key(self):
        class Store:
            def read(self): return 'synthetic-private-value'
        _, output = self.call('read-for-plugin', Store())
        self.assertEqual(json.loads(output), {'state':'present','key':'synthetic-private-value'})

    def test_set_requires_tty_and_never_falls_back_to_echo(self):
        with patch.object(keychain.sys.stdin,'isatty',return_value=False), patch.object(keychain.getpass,'getpass') as prompt:
            result, output = self.call('set', object())
        self.assertEqual(result, 1)
        self.assertEqual(json.loads(output), {'state':'terminal-required'})
        prompt.assert_not_called()

    def test_explicit_environment_import_keeps_key_out_of_output(self):
        class Store:
            def set(self, value): self.value=value
        store=Store()
        with patch.dict(keychain.os.environ, {'TYPESAFE_API_KEY':'synthetic-private-value'}):
            result,output=self.call('import-env',store)
        self.assertEqual(result,0)
        self.assertEqual(store.value,'synthetic-private-value')
        self.assertNotIn(store.value,output)

    def test_delete_failure_is_redacted_and_not_success(self):
        class Store:
            def remove(self): raise OSError('synthetic-private-value')
        result,output=self.call('remove',Store())
        self.assertEqual(result,1)
        self.assertEqual(json.loads(output), {'state':'unavailable'})

    def test_unsupported_platform_has_no_plaintext_fallback(self):
        with patch.object(keychain.sys,'platform','linux'), contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(keychain.main(['read-for-plugin']),0)
        self.assertEqual(json.loads(output.getvalue()), {'state':'unsupported'})

    def test_key_in_argument_is_rejected_without_echo(self):
        with contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertEqual(keychain.main(['set','synthetic-private-value']),2)
        self.assertNotIn('synthetic-private-value',output.getvalue())
