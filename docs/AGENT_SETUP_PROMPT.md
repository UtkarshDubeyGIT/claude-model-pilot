# Give this prompt to your agent

Copy the block below into Claude Code, Codex or another local coding agent. It authorizes setup in advisory mode, keeps credentials out of the conversation, and asks the agent to report what it actually verified.

```text
Install and configure Model Pilot, the Jev-powered Claude Code model router, from:
https://github.com/UtkarshDubeyGIT/claude-model-router-mod

Read the repository README, docs/INSTALL.md and SECURITY.md, then inspect its
plugin/marketplace manifests and production hooks before installing. Check my
Claude Code version and existing plugin installation. Use the official Claude
plugin marketplace commands and user scope unless I specify another scope.
Preserve existing Claude settings and unrelated plugins; do not overwrite them.

Keep Model Pilot in its default advisory mode. Explain that eligible current
prompts go to TypeSafe when a key is configured, including in advisory mode,
and that TypeSafe and Claude charges are separate. Do not enable automatic
routing or run paid benchmarks unless I ask.

Jev uses TYPESAFE_API_KEY. Check only whether it is present, never its value.
Do not ask me to paste the key into chat, print it, save it in this repository,
read it from another process, or commit it. If it is missing from the shell
that will launch Claude, show the hidden-input command for my shell so I can
enter it privately, then launch Claude from that same shell. Never assume a
key set in a different terminal is inherited by your command runner.

Verify the install with Claude's plugin list and /route status where you have
access. Explain /route auto, /route advise, /route off, /route pin, /route unpin,
/route new, /route profiles and /route trace. Opus planning sessions must retain
their selected model and effort, including simple asides; do not weaken that
protection. Respect organization-managed plugin, model and network policies.
If policy or terminal access prevents a step, report the exact limit and give
me the next command to run instead of bypassing it.

Finish with the installed version, scope, checks performed, any remaining
manual step, and how to disable or remove the plugin. Distinguish a successful
installation from a live Jev/model-routing test, and do not claim savings.
```

If you want a later live evaluation, explicitly ask the agent to run the small live suite with a budget and synthetic prompts first. For the broader benchmark, review [the benchmark guide](benchmark.md), including separate formatting/correctness scores and billing limits.
