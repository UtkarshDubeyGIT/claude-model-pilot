# Install and use Model Pilot

Use a current Claude Code CLI; **2.1.303** is the tested version. Native mods require **2.1.287 or later**, but older host versions have not been validated for this project. Check with `claude --version`. The runtime needs no npm install, build step or separate proxy. See [Claude's mod guide](https://code.claude.com/docs/en/plugins/mods/create).

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

Create a key in the [TypeSafe console](https://console.typesafe.ai). Enter it in a terminal without putting it in shell history. Choose the block for your shell.

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

Expect advisory mode and the Jev classifier. Submit a harmless standalone prompt such as `What does HTTP stand for?`, then inspect `/route status` and `/route trace`. In advisory mode, the outgoing model remains your selected model; the trace distinguishes the provider result and the recommendation. This is a live provider call and can incur charges.

To apply future recommendations:

```text
/route auto
```

Do that in a fresh, non-planning session with approved model access. Missing keys, uncertainty, failures or continuity protections can legitimately keep the model unchanged. A routed model is only marked confirmed when the response reports that model. Requested effort is shown separately; effective reasoning effort is not independently exposed.

For planning, select Opus and the effort you want with Claude Code's model controls, then enter plan mode. Model Pilot preserves both through follow-ups and simple asides. A manual model change also pins routing; `/route unpin` releases that pin but does not disable planning protection. `/route new` marks a new task and retains any pin.

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
| `missing-key` | Export the key before launching Claude from the same shell. Never print the value to debug it. |
| HTTP error | Check the key, provider access and organization network policy. Share only the status code. |
| Timeout or abstention | Claude keeps your selection. Inspect the provider state in `/route trace`; a failed call is not a model recommendation. |
| Advice appears but no model switch | Advisory is the default. Enable `/route auto` if desired; check pins, plan mode and continuity. |
| “Planning is protected” outside plan mode | The mod may not be receiving permission-mode lifecycle events. Check host errors and managed policy; do not remove the protection to force routing. |
| Correct target requested but API model differs | The host/provider may have applied a fallback. The trace reports a mismatch; do not count it as successful routing. |
| Custom gateway stays on selected model | Supply explicit deployment mappings for enabled target families and validate model access. |
| Benchmark reaches its final numbered session | That line announces the session's start, not completion. Wait for the saved report/completion message; inspect the timestamped result if it stops. |

Do not delete unrelated Claude hooks or change organization settings to solve a router setup problem. Provide a redacted trace and version information in a [bug report](https://github.com/UtkarshDubeyGIT/claude-model-router-mod/issues).

## Enterprise deployment

Review the mod's source, external TypeSafe data flow and allowed target models before a pilot. Start in advisory mode. Inject credentials through the organization's secret manager and test with non-sensitive prompts first.

Claude distinguishes organization-owned mods from user mods. Merely enabling this GitHub marketplace through managed settings does not give it organization-owned status. Under current documented rules, that requires managed `enabledPlugins`, an administrator-controlled local directory marketplace named by absolute path, and a relative plugin source loaded in place. Settings such as `allowManagedModsOnly` can reject user mods, including `--plugin-dir` copies. Follow the [official managed-mod deployment guide](https://code.claude.com/docs/en/plugins/mods/admin) rather than weakening policy.

Model Pilot observes `classic.SessionStart` and `classic.UserPromptSubmit` for permission mode. Host versions and managed policies can restrict lifecycle hooks. Confirm that these events reach the installed mod in your environment. Missing mode keeps routing protected. This fallback is intentional; user installation alone is not proof of enterprise compatibility.

For gateways, Bedrock, Vertex and Foundry, configure explicit target deployment IDs using the applicable `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL` and `ANTHROPIC_DEFAULT_OPUS_MODEL` variables. Validate each target and effort with your deployment. Unknown starting families remain unchanged; the mod cannot guarantee model availability or override host effort caps.
