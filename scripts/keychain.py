#!/usr/bin/env python3
"""Model Pilot's macOS credential adapter. No plaintext fallback or dependencies.

set/import-env are user-invoked terminal actions. read-for-plugin is an internal
IPC operation: its stdout contains the key and must never be logged or shown.
"""
import ctypes as c
import getpass
import json
import os
import sys
import warnings

SERVICE = b'ai.model-pilot.typesafe'
ACCOUNT = b'default'
NOT_FOUND = -25300


class KeychainError(Exception):
    pass


def valid_key(value):
    return (isinstance(value, str) and '\r' not in value and '\n' not in value
            and 0 < len(value.strip()) <= 4096
            and all(33 <= ord(ch) <= 126 for ch in value.strip()))


class MacKeychain:
    def __init__(self, service=SERVICE, interactive=False):
        if sys.platform != 'darwin':
            raise KeychainError('unsupported')
        self.service = service
        self.sec = c.CDLL('/System/Library/Frameworks/Security.framework/Security')
        self.cf = c.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
        self.cf.CFRelease.argtypes = [c.c_void_p]
        self.cf.CFRelease.restype = None
        signatures = {
            'SecKeychainSetUserInteractionAllowed': [c.c_bool],
            'SecKeychainFindGenericPassword': [c.c_void_p, c.c_uint32, c.c_char_p,
                c.c_uint32, c.c_char_p, c.POINTER(c.c_uint32), c.POINTER(c.c_void_p), c.POINTER(c.c_void_p)],
            'SecKeychainAddGenericPassword': [c.c_void_p, c.c_uint32, c.c_char_p,
                c.c_uint32, c.c_char_p, c.c_uint32, c.c_void_p, c.POINTER(c.c_void_p)],
            'SecKeychainItemModifyAttributesAndData': [c.c_void_p, c.c_void_p, c.c_uint32, c.c_void_p],
            'SecKeychainItemFreeContent': [c.c_void_p, c.c_void_p],
            'SecKeychainItemDelete': [c.c_void_p],
        }
        for name, args in signatures.items():
            fn = getattr(self.sec, name)
            fn.argtypes = args
            fn.restype = c.c_int32
        self._check(self.sec.SecKeychainSetUserInteractionAllowed(interactive))

    @staticmethod
    def _check(status):
        if status != 0:
            raise KeychainError('unavailable')

    def _find(self, read=False):
        item, data, size = c.c_void_p(), c.c_void_p(), c.c_uint32()
        status = self.sec.SecKeychainFindGenericPassword(None, len(self.service), self.service,
            len(ACCOUNT), ACCOUNT, c.byref(size) if read else None,
            c.byref(data) if read else None, c.byref(item))
        if status == NOT_FOUND:
            return None, None
        self._check(status)
        try:
            if read and size.value > 4096:
                raise KeychainError('unavailable')
            value = c.string_at(data, size.value).decode('utf-8') if read else None
            return item, value
        except Exception:
            if item: self.cf.CFRelease(item)
            raise KeychainError('unavailable') from None
        finally:
            if data: self.sec.SecKeychainItemFreeContent(None, data)

    def read(self):
        item, value = self._find(read=True)
        if item: self.cf.CFRelease(item)
        return value

    def set(self, value):
        if not valid_key(value):
            raise KeychainError('invalid')
        encoded = value.strip().encode('utf-8')
        item, _ = self._find()
        try:
            if item:
                status = self.sec.SecKeychainItemModifyAttributesAndData(item, None, len(encoded), encoded)
            else:
                status = self.sec.SecKeychainAddGenericPassword(None, len(self.service), self.service,
                    len(ACCOUNT), ACCOUNT, len(encoded), encoded, None)
            self._check(status)
        finally:
            if item: self.cf.CFRelease(item)

    def remove(self):
        item, _ = self._find()
        if item:
            try: self._check(self.sec.SecKeychainItemDelete(item))
            finally: self.cf.CFRelease(item)
        # Do not claim success solely from a process exit or a write response.
        item, _ = self._find()
        if item:
            self.cf.CFRelease(item)
            raise KeychainError('unavailable')


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1 or args[0] not in ('set', 'import-env', 'status', 'read-for-plugin', 'remove'):
        print('Usage: keychain.py set|import-env|status|remove. Never pass a key as an argument.', file=sys.stderr)
        return 2
    action = args[0]
    try:
        store = MacKeychain(interactive=action in ('set', 'import-env') or (action=='remove' and sys.stdin.isatty()))
        if action in ('set', 'import-env'):
            if action == 'set':
                if not sys.stdin.isatty():
                    raise KeychainError('terminal-required')
                # Refuse getpass's echoing fallback rather than exposing the key.
                with warnings.catch_warnings():
                    warnings.simplefilter('error', getpass.GetPassWarning)
                    value = getpass.getpass('TypeSafe API key (hidden): ')
            else:
                value = os.environ.get('TYPESAFE_API_KEY')
            if not valid_key(value):
                raise KeychainError('invalid')
            store.set(value)
            print('Saved to macOS Keychain. Use /route key status in Claude. Environment overrides still take priority.')
        elif action == 'remove':
            store.remove()
            print(json.dumps({'state': 'removed'}))
        else:
            value = store.read()
            result = {'state': 'present' if value else 'missing'}
            if action == 'read-for-plugin' and value:
                result['key'] = value
            print(json.dumps(result))
        return 0
    except (KeychainError, OSError, ValueError, getpass.GetPassWarning, EOFError, KeyboardInterrupt) as error:
        state = str(error) if isinstance(error, KeychainError) else 'unavailable'
        if state not in ('unsupported', 'invalid', 'terminal-required'): state = 'unavailable'
        print(json.dumps({'state': state}))
        return 0 if action in ('status','read-for-plugin') else 1


if __name__ == '__main__':
    raise SystemExit(main())
