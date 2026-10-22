# Give this prompt to your agent

```text
Install Model Pilot 0.7.0 experimental from:
https://github.com/UtkarshDubeyGIT/claude-model-router-mod

Read README.md, docs/INSTALL.md and SECURITY.md. Inspect the plugin manifests
and production hooks. Check my Claude Code version and existing installation.
Install using official marketplace commands in user scope unless I choose
another scope. Preserve unrelated plugins and settings.

Explain before use: advice is enabled by default and eligible UNFINISHED
DRAFTS go to TypeSafe after two seconds without editing. Calls are separately
billed; the mod keeps draft/cache state only in memory. No automatic routing
exists. Only my acceptance of a specific suggestion may authorize a change.
Use for this task / Dismiss and /route accept ID /route dismiss ID are the
controls. Speed is secondary to quality and cost. Never weaken mandatory
correctness, safety, functionality or required formatting to save money.

For persistent keys on macOS, explain /route key setup. Let me run the
keychain.py set helper myself in a separate terminal and enter the key at its
hidden prompt. Python 3 and an accessible macOS Keychain are required; there
is no plaintext fallback. An existing shell export can be saved with the
helper's import-env action, run by me in that shell. Never run the internal
read-for-plugin action for inspection: its output is secret IPC.
On other platforms or for enterprise injection use TYPESAFE_API_KEY. It takes
priority over any saved key. Never print a key, put it in arguments, save it
in the repository, ask for it in chat, or recover it from another process.
Explain /route key status, replace, test and remove. A test requires explicit
confirmation and may be billable. Deletion is local, not provider revocation.

Verify plugin list, the persistent Model Pilot line above the composer, and
/route status where available. The line makes no provider calls; Claude surveys
or a collapsed band can hide it. /route off leaves an off indicator visible. Report key presence,
permission state, current eligibility and last assessment reason. Do not
promise a recommendation for every prompt. Zero calls with an ongoing task
means continuity protection; use /route new only after that task is finished. Explain /route check,
/route new, /route pin, /route unpin, /route off, /route profiles and /route trace.
Planning and related implementation/follow-ups/asides must preserve the task's
model and effort. Leaving plan mode is not a task boundary. Unknown permission
state stays protected; some hosts only expose it after the first answer.
Resumed sessions protect the host selection; acceptance is session-memory only.
Respect organization-managed plugin, model and network policies.

Do not run paid benchmarks unless I request them. Offline tests are synthetic,
not evidence of Jev accuracy. Finish with installed version, scope, checks,
remaining steps and disable/uninstall commands. Do not claim measured savings.
```
