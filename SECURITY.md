# Security and data handling

## Data flows

Model Pilot runs inside Claude Code as a native mod. Its classifier, Jev, uses an explicit `TYPESAFE_API_KEY` environment override or the user's saved macOS Keychain entry and sends eligible unfinished draft text to the fixed HTTPS endpoint `https://api.typesafe.ai/v1/systemone`. Advice is enabled by default. After two seconds without editing, an eligible draft can be sent even if the user never submits it to Claude. Automatic routing does not exist in 0.6 or 0.7. It sends no conversation history or attached files and limits input to 4,000 characters.

The key is used in the Authorization header; it is never included in UI, diagnostics, traces or process arguments. Persistent setup is an explicit terminal action. The Python 3 helper calls macOS Security.framework directly to store, update, read and delete only service `ai.model-pilot.typesafe`, account `default`. That entry is shared across this user's Model Pilot projects/installations. The helper refuses plaintext fallback and hidden-input fallback that would echo the key. Windows/Linux require environment injection for now. No production filesystem or telemetry API is called by the mod.

When no environment override is supplied, the mod invokes the bundled helper through `$.process.run` to read the Keychain. The internal `read-for-plugin` stdout is secret IPC consumed in memory: never run it for inspection or log it. The helper may return a key to the mod and the host process machinery; other mods or host-level tracing can observe these calls, as they can observe the HTTP Authorization header. Keychain protects storage at rest, not an untrusted Claude process or plugin. Treat all installed mods and the Python runtime as trusted code. Background reads do not open Keychain authorization dialogs; denied/locked access fails closed.

`/route key status` makes no network call. Authentication is unverified until a successful TypeSafe response in this session. A 401/403 marks rejection and stops automatic retrying that credential; quota/server errors do not prove the key is invalid. `/route key test confirm` explicitly sends a fixed synthetic question, may be billable, and cannot accept advice or switch a model. Tests share the physical-request and call-interval limits. Rotation clears prior authentication evidence and unconsumed advice, while preserving the task profile. `/route key remove confirm` verifies local deletion; it does not unset environment overrides, revoke provider access, erase third-party logs, or recall requests already sent. Other sessions recheck storage on their next credential lookup. Delete the shared key before uninstalling if desired.

`TYPESAFE_MODEL` can select an available Jev version. `/route off` and `/route classifier off` stop new draft assessments. There is no local/Haiku fallback. Turning advice off cannot cancel a request already sent; an explicitly confirmed key test is still available.

The mod's routing deadline limits how long it waits. Claude Code's HTTP interface does not cancel an already-issued request, so a late request may still be billed. Late responses cannot alter the chosen route. Error response bodies are not shown, and only one physical request may remain in flight. Later eligible drafts can be assessed subject to the ten-second minimum interval; a timed-out underlying request is never used to alter a submitted turn.

Drafts and up to 32 draft/context cache entries exist only in session memory. Explicit `/route check` commands can appear in Claude’s normal transcript. Decision traces contain parsed classification, policy and model/effort observations, not prompts or keys. Trace state is held in memory. Claude Code still applies its normal transcript, diagnostics and provider handling; other trusted or untrusted mods may observe host events or API calls. The separate evaluation scripts save prompts and answers locally for scoring, so review those files before sharing them.

## Trust and controls

Claude Code mods are not sandboxed by the host; install only source you trust. This project's limited API usage is a property of the reviewed source, not a host-enforced sandbox. Enterprise administrators should validate the installed revision and follow [Claude's managed-mod documentation](https://code.claude.com/docs/en/plugins/mods/admin).

Classifier input is treated as data, never executed. Only validated bounded fields affect recommendations. Planning, pins, hidden context and continuity are checked before sending eligible tasks for classification. These routing protections are heuristics, not access-control boundaries or promises of answer quality.

The mod does not override organizational model permissions, effort limits or network policy. If permission-mode observation is missing, it preserves the current model. Application requires explicit acceptance of a displayed recommendation bound to its draft and task. Model, effort, mode and task changes invalidate unconsumed consent. A provider or host may reject an accepted target; the mod does not replay a streamed request.

Use your organization's approved secret manager and provider policies. Never put a key in a repository, issue, screenshot, chat prompt or `/route` command. If a key is exposed, revoke it through the provider and replace it. Do not ask an agent to recover a key from another application's process or terminal.

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** action on the [Security tab](https://github.com/UtkarshDubeyGIT/claude-model-router-mod/security) if the repository owner has enabled private reporting. If that action is unavailable, open an issue asking for a private reporting channel without including exploit details, secrets or proprietary traces.

Include the affected version, host version, a synthetic reproduction, impact and any suggested fix. No response-time or enterprise support commitment is currently offered. Until a private channel is available, do not publish sensitive exploitation details in public issues.
