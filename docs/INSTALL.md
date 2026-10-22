# Install and use Model Pilot

Use a current Claude Code CLI; **2.1.308** is the tested version. Native mods require **2.1.287 or later**, but older host versions have not been validated for this project. Check with `claude --version`. The runtime needs no npm install, build step or separate proxy. See [Claude's mod guide](https://code.claude.com/docs/en/plugins/mods/create).

## Install from GitHub

In your terminal:

```sh
claude plugin marketplace add UtkarshDubeyGIT/claude-model-router-mod
claude plugin install model-pilot@model-pilot-marketplace --scope user
claude plugin list
```

Inside an existing Claude Code session, the equivalent commands are:

```text
/plugin marketplace add UtkarshDubeyGIT/claude-model-router-mod
/plugin install model-pilot@model-pilot-marketplace
```

The interactive installer lets you select scope. User scope is available across your projects; local scope applies only to you in the current project. Choose project scope only when you intend to enable it for collaborators. Start a fresh session after installation. Follow the host's reload message if installing into a running session. [Official installation instructions](https://code.claude.com/docs/en/plugins/install).

## Set the TypeSafe key

Create a key in the [TypeSafe console](https://console.typesafe.ai).

### Persistent setup on macOS (recommended)

Run `/route key setup` in Claude. Copy its `python3 .../scripts/keychain.py set` command into a **separate terminal**, then type the key at the hidden prompt. Never pass it as a command argument or paste it into chat. Python 3 is required. macOS may ask to allow Keychain access during setup; background reads do not open authorization dialogs.

Use `/route key status` afterward. The mod reads the saved key on the next credential check, including in new sessions. Keys are scoped to your macOS user across all Model Pilot installations/projects, under service `ai.model-pilot.typesafe`, account `default`. Plugin updates keep the entry.

If you already exported the key in that terminal, use the same helper command with `import-env` instead of `set`. This explicitly saves the shell's `TYPESAFE_API_KEY` without printing it or adding it to command history. Do not ask an agent to retrieve it from another process.

- **Replace:** `/route key replace` shows the setup command again. Saving overwrites the same Keychain entry; `/route key status` reloads it and clears previous authentication evidence and unconsumed advice. The protected task profile stays intact.
- **Verify:** `/route key test` explains the request. `/route key test confirm` sends one fixed synthetic question to TypeSafe, which may be billable. No draft/history is sent and no recommendation is accepted. It shares the single-flight/ten-second rate limit. A successful normal Jev request also verifies authentication for that session.
- **Remove:** `/route key remove`, then `/route key remove confirm`, deletes this entry and verifies deletion. It does not revoke the key at TypeSafe, unset an environment override, or recall requests already sent. Other sessions reload on their next credential check. Uninstalling the plugin does not remove this shared entry; delete it before uninstalling if desired.
- **Locked/denied Keychain or missing Python:** the status reports unavailable; unlock/authorize through the terminal helper and retry. There is **no plaintext fallback**.

The mod reads only its own Keychain entry. It does not use Claude's generic sensitive-plugin storage: isolated host tests found plaintext fallback when Keychain was unavailable and empty-value clearing that did not remove a saved credential. The dedicated adapter avoids those behaviors.

### Environment and enterprise setup (all platforms)

An explicitly supplied `TYPESAFE_API_KEY` takes priority over a saved key. An invalid nonempty override fails closed rather than silently using a different account. To use the saved key instead, unset the variable and restart Claude from that shell. Windows/Linux currently use environment injection; native credential-store adapters for those platforms are not shipped.

Enter it in a terminal without putting it in shell history. Choose the block for your shell.

**zsh:**

```zsh
read -rs 'TYPESAFE_API_KEY?TypeSafe API key: '
export TYPESAFE_API_KEY
printf '\n'
claude
```

**Bash:**

```bash
read -r -s -p 'TypeSafe API key: ' TYPESAFE_API_KEY
export TYPESAFE_API_KEY
printf '\n'
claude
```

The typed key is hidden. It remains in that shell's environment for programs started afterward. A separate terminal, an already-running Claude session, and an agent's command runner do not automatically inherit it. Relaunch Claude from the configured shell. Do not paste the key into the agent conversation or save it in the repository. For long-term use, prefer your approved secret manager.

Jev defaults to `jev-latest`; optionally export `TYPESAFE_MODEL` with an available version before starting Claude. See [TypeSafe's quickstart](https://docs.typesafe.ai/introduction/quickstart).

## Verify a session

Inside Claude Code:

```text
/route status
/route profiles
```

`/route status` makes no Jev request. It shows permission state, credential source and last authentication state, current eligibility and the last assessment reason. `Provider: skipped` with zero classifier calls means assessment was protected, not that Jev recommended your model.

Advice is enabled and Jev is the provider. **Eligible unfinished drafts go to TypeSafe after two seconds without editing**, whether or not you submit them. The mod stores no persistent drafts. Calls are separately billed. Use `/route off` to stop new assessment.

A compact Model Pilot status line appears above the composer before you type, including when advice is unavailable or off. It preserves other mods in that band and makes no Jev request merely to render. Claude surveys take precedence; if you collapsed the band, expand it with `ctrl+x ctrl+a`. The line confirms the mod loaded, not that TypeSafe authentication succeeded.

Type a harmless standalone draft. When eligible and supported by confident evidence, a card offers **Use for this task / Dismiss**. Sending without acceptance keeps your current profile. Silence can mean the current profile fits, continuity protects it, or evidence is unavailable. Inspect `/route trace` for the distinction.

The host must expose permission state first. This includes a fresh interactive terminal on the tested host: the visible “auto mode on” footer does not establish permission state for the mod. Some hosts expose it only with the first normal answer. The status line shows “waiting for session state” while it is unknown, and no assessment runs; after finishing that task, `/route new` starts a new independent task. Headless clients can explicitly assess with `/route check <prompt>`, accept the returned ID with `/route accept <id>`, then send the exact prompt. Do not issue `/route new` in the middle of work merely to force a suggestion.

Accepted profiles are applied at dispatch, then retained for task follow-ups only after API model confirmation. Effort is the requested effort; provider-internal effort is not independently observable. Editing the draft or changing model, effort, mode or task boundary invalidates unconsumed acceptance. `/route auto` only explains this migration.

Select Opus and your preferred effort before starting a plan. Planning, related implementation, short follow-ups, simple asides and returning to the plan remain protected. Leaving plan mode does not clear continuity. `/route new` cannot override plan mode or pins. Reloading loses volatile acceptance; resumed sessions protect the host's selected profile.

## Update, disable or remove

In your terminal:

```sh
claude plugin marketplace update model-pilot-marketplace
claude plugin update model-pilot@model-pilot-marketplace
```

For a pause in the current session, use `/route off`. To disable or uninstall the plugin for your user account:

```sh
claude plugin disable model-pilot@model-pilot-marketplace --scope user
claude plugin uninstall model-pilot@model-pilot-marketplace --scope user
```

Use the scope you installed. Start a new session after changes. [Claude plugin command reference](https://code.claude.com/docs/en/plugins/cli-reference).

## Try a local clone

```sh
git clone https://github.com/UtkarshDubeyGIT/claude-model-router-mod.git
claude --plugin-dir ./claude-model-router-mod
```

This loads the local checkout for that session. Use the correct path when starting Claude in another project. Avoid loading a second marketplace copy at the same time.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| `/route` is missing | Confirm the plugin is enabled with `claude plugin list`; inspect `/plugin` errors; start a fresh session. |
| `ongoing task protected`, zero classifier calls | Expected continuity protection. Finish the task; use `/route new` only for a genuinely independent task. |
| `Permission state is unknown` | Wait for authoritative host lifecycle state, which may arrive with the first normal answer. After finishing that task, use `/route new`; it cannot bypass unknown state. |
| Context reload may outweigh savings | The initial policy suppresses cheaper-profile suggestions above 8,000 context tokens, or with unmeasured non-fresh context. This is a conservative heuristic, not measured savings. Test separately in a low-context session; do not discard ongoing work to force advice. |
| `missing-key` | Export the key before launching Claude from the same shell. Never print the value to debug it. |
| HTTP error | Check the key, provider access and organization network policy. Share only the status code. |
| Timeout or abstention | Claude keeps your selection. Inspect the provider state in `/route trace`; a failed call is not a model recommendation. |
| Advice appears but no model switch | Accept the specific suggestion before sending; check stale drafts, pins, plan mode and continuity. No automatic mode exists. |
| “Planning is protected” outside plan mode | The mod may not be receiving permission-mode lifecycle events. Check host errors and managed policy; do not remove the protection to force routing. |
| Correct target requested but API model differs | The host/provider may have applied a fallback. The trace reports a mismatch; do not count it as successful routing. |
| Custom gateway stays on selected model | Supply explicit deployment mappings for enabled target families and validate model access. |
| Benchmark reaches its final numbered session | That line announces the session's start, not completion. Wait for the saved report/completion message; inspect the timestamped result if it stops. |

Do not delete unrelated Claude hooks or change organization settings to solve a router setup problem. Provide a redacted trace and version information in a [bug report](https://github.com/UtkarshDubeyGIT/claude-model-router-mod/issues).

## Enterprise deployment

Review the mod's source, external TypeSafe data flow and allowed target models before a pilot. Start in advisory mode. Inject credentials through the organization's secret manager and test with non-sensitive prompts first.

Claude distinguishes organization-owned mods from user mods. Merely enabling this GitHub marketplace through managed settings does not give it organization-owned status. Under current documented rules, that requires managed `enabledPlugins`, an administrator-controlled local directory marketplace named by absolute path, and a relative plugin source loaded in place. Settings such as `allowManagedModsOnly` can reject user mods, including `--plugin-dir` copies. Follow the [official managed-mod deployment guide](https://code.claude.com/docs/en/plugins/mods/admin) rather than weakening policy.

Model Pilot observes `classic.SessionStart` and `classic.UserPromptSubmit` for permission mode, with additional conservative plan indicators. The current host has no general pre-draft permission getter. Host versions and managed policies can restrict lifecycle hooks. Confirm that these events reach the installed mod in your environment. Missing mode keeps routing protected. This fallback is intentional; user installation alone is not proof of enterprise compatibility.

For gateways, Bedrock, Vertex and Foundry, configure explicit target deployment IDs using the applicable `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL` and `ANTHROPIC_DEFAULT_OPUS_MODEL` variables. Validate each target and effort with your deployment. Unknown starting families remain unchanged; the mod cannot guarantee model availability or override host effort caps.
