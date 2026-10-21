# Security and data handling

## Data flows

Model Pilot runs inside Claude Code as a native mod. The production source does not call filesystem, process or telemetry APIs. Its default classifier, Jev, uses `TYPESAFE_API_KEY` from the environment and sends eligible current prompt text to the fixed HTTPS endpoint `https://api.typesafe.ai/v1/systemone`. This occurs in **advisory as well as automatic mode** when a key is configured. It sends no conversation history or attached files and limits input to 4,000 characters.

The key is used in the Authorization header; the mod does not print or persist it. `TYPESAFE_MODEL` can select an available Jev version. The optional Haiku classifier uses Claude Code's existing credentials and billing. `/route off` stops classifier calls; `/route classifier off` uses local rules only.

The mod's routing deadline limits how long it waits. Claude Code's HTTP interface does not cancel an already-issued request, so a late request may still be billed. Late responses cannot alter the chosen route. Error response bodies are not shown, and the mod performs no automatic retries.

Decision traces contain parsed classification, policy and model/effort observations, not prompts or keys. Trace state is held in memory. Claude Code still applies its normal transcript, diagnostics and provider handling; other trusted or untrusted mods may observe host events or API calls. The separate evaluation scripts save prompts and answers locally for scoring, so review those files before sharing them.

## Trust and controls

Claude Code mods are not sandboxed by the host; install only source you trust. This project's limited API usage is a property of the reviewed source, not a host-enforced sandbox. Enterprise administrators should validate the installed revision and follow [Claude's managed-mod documentation](https://code.claude.com/docs/en/plugins/mods/admin).

Classifier input is treated as data, never executed. Only validated bounded fields affect recommendations. Planning, pins, hidden context and continuity are checked before sending eligible tasks for classification. These routing protections are heuristics, not access-control boundaries or promises of answer quality.

The mod does not override organizational model permissions, effort limits or network policy. If permission-mode observation is missing, it preserves the current model. A provider or host may reject an automatic target; the mod does not replay a streamed request.

Use your organization's approved secret manager and provider policies. Never put a key in a repository, issue, screenshot, chat prompt or `/route` command. If a key is exposed, revoke it through the provider and replace it. Do not ask an agent to recover a key from another application's process or terminal.

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** action on the [Security tab](https://github.com/UtkarshDubeyGIT/claude-model-router-mod/security) if the repository owner has enabled private reporting. If that action is unavailable, open an issue asking for a private reporting channel without including exploit details, secrets or proprietary traces.

Include the affected version, host version, a synthetic reproduction, impact and any suggested fix. No response-time or enterprise support commitment is currently offered. Until a private channel is available, do not publish sensitive exploitation details in public issues.
