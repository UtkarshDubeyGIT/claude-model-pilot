<img width="2172" height="724" alt="image" src="https://github.com/user-attachments/assets/07df6688-d734-4d51-af1f-9e467634baef" alt="Model Pilot — Claude Code mod for suggesting the right model"/>
<div align="center">

# Model Pilot

**A Claude Code mod that suggests the right model and reasoning effort for your task — before you send.**

Spend less on simpler tasks, use stronger reasoning when it matters, and stay in control of every suggestion.

[Installation](#installation) · [How it works](#how-it-works) · [Commands](#commands) · [Documentation](#documentation)

</div>

## What is Model Pilot?

Model Pilot is a **model and effort suggester for Claude Code**. It examines eligible unfinished prompts and recommends a different Claude model or reasoning effort **only when there is enough evidence that the change could improve the quality–cost tradeoff**.

It can recommend a lighter model for straightforward work, a stronger one for demanding tasks, or a different effort level on your current model. **It never switches your model without your approval.**

### Highlights

- **Suggestions before sending:** See advice while composing your prompt, not after the request has started.
- **Quality-aware choices:** Balance cost with correctness, safety, functionality, and required output format.
- **You decide:** Accept the suggested profile for this task or dismiss it and keep your current selection.
- **Task continuity:** Keep the accepted model across related follow-ups, planning, and implementation.
- **Explainable behavior:** Inspect the current state, decision trace, and model profiles using `/route` commands.
- **Conservative by design:** When evidence or required session state is missing, Model Pilot does not guess.

## Installation

### 1. Install the Claude Code plugin

Run these commands in your terminal:

```bash
claude plugin marketplace add UtkarshDubeyGIT/claude-model-router-mod
claude plugin install model-pilot@model-pilot-marketplace --scope user
```

### 2. Configure TypeSafe

Model Pilot uses TypeSafe to assess eligible drafts. Create an API key in the [TypeSafe console](https://console.typesafe.ai).

**macOS:** Inside Claude Code, run:

```text
/route key setup
```

Follow the instructions to enter your key securely in a **separate terminal**. The setup helper saves it in macOS Keychain (requires Python 3), without writing a plaintext credentials file.

**Windows / Linux / managed environments:** Supply `TYPESAFE_API_KEY` in the environment that launches Claude Code. See the [key setup guide](docs/INSTALL.md#set-the-typesafe-key) for supported methods.

**Important:** Advice is enabled by default. **Eligible drafts can be sent to TypeSafe after you pause typing, even if you never submit them to Claude.** TypeSafe usage can incur separate charges. Review the [security disclosure](SECURITY.md) before using the mod with sensitive information. Use `/route off` to stop new assessments.

### 3. Check that it's ready

In Claude Code, run:

```text
/route status
```

This displays the current task protection, key state, permission state, and last assessment reason. The status command itself makes no provider call.

For complete setup instructions, see [docs/INSTALL.md](docs/INSTALL.md). Prefer having an agent handle setup? Use the [agent setup prompt](docs/AGENT_SETUP_PROMPT.md).

## How it works

1. **Write a prompt.** In an eligible session, pause typing for roughly two seconds.
2. **Review a suggestion.** If Model Pilot finds a justified alternative, it shows the proposed model and effort, expected benefit, and tradeoff.
3. **Choose what to do.** Select **Use for this task** or **Dismiss**. No suggestion means your current selection remains in place.
4. **Keep working.** An accepted profile stays with that task's related follow-ups. Model Pilot protects planning continuity and does not change your saved Claude defaults.

A compact status line shows what Model Pilot is doing, even when there is no recommendation:

```text
🧭 Model Pilot │ Sonnet · high │ 🔑 key ready │ 🔒 task protected │ /route
```

**The key distinction:** Model Pilot **suggests**; you approve. It does not delay a request to wait for advice, or replay a request that has already started. Suggestions are predictions, not guarantees of cost savings or answer quality.

## Commands

| Command | What it does |
| --- | --- |
| `/route status` | Show active profile, protections, key state, and assessment status |
| `/route check <prompt>` | Explicitly assess a prompt, including in headless workflows |
| `/route trace` | Show a sanitized decision trace without the draft text |
| `/route profiles` | View the available model/effort mappings |
| `/route advise` | Enable advice |
| `/route off` | Stop new assessments and application |
| `/route new` | Mark the start of an independent task |
| `/route pin` / `/route unpin` | Keep or release a manually chosen model |
| `/route accept <id>` / `/route dismiss <id>` | Accept or dismiss a matching suggestion |
| `/route key setup` / `/route key status` | Configure a saved key or inspect key status |
| `/route key replace` / `/route key remove` | Replace or remove a saved key |
| `/route key test` | Prepare an optional, potentially billable authentication check |
| `/route classifier jev` / `/route classifier off` | Enable or disable the classifier |

The `/route auto` command is retained for migration guidance; **automatic model switching is not supported**. A manual model selection pins the current profile. Task boundaries do not override a pin or planning protection.

## Troubleshooting

**I don't see a suggestion.** This can be normal: your current model may already fit, the evidence may be insufficient, or context-switching may outweigh the potential benefit. Use `/route trace` to inspect the reason.

**It says “task protected.”** Model Pilot won't reassess the middle of an ongoing task. Finish that task, then use `/route new` when beginning a genuinely independent task.

**It says “waiting for session state.”** Claude Code has not yet exposed the lifecycle/permission information needed to assess safely. Some sessions provide it only after the first response. Do not bypass this protection.

**My key isn't available.** Check `/route key status`. On macOS, ensure Keychain is unlocked and Python 3 is installed. On other platforms, confirm `TYPESAFE_API_KEY` is provided to the Claude Code process.

**Does Claude Code's “auto mode” enable routing?** No. That is a tool-permission mode, not Model Pilot's model selection.

See the [installation guide](docs/INSTALL.md) and [validation notes](docs/validation.md) for more details.

## Privacy and safeguards

- **Draft assessments:** Eligible unfinished prompt text is sent to TypeSafe when advice is enabled, including drafts you do not submit to Claude.
- **Costs:** TypeSafe assessments are charged separately; explicitly running `/route check` can also incur charges.
- **Local handling:** The mod keeps drafts and assessment caches in session memory and does not write its own prompt logs.
- **Credentials:** macOS saved-key setup uses Keychain. An environment-provided key takes precedence. Never paste API keys into a chat message or command argument.
- **User approval:** Only accepting a matching suggestion authorizes its use. Editing the draft or changing model, effort, mode, or task boundary can invalidate that approval.
- **Safe fallback:** If needed session details, model mappings, or other required inputs are unavailable, assessment is skipped rather than forced.

For the full data-flow and deployment considerations, read [SECURITY.md](SECURITY.md) and the [enterprise setup guide](docs/INSTALL.md#enterprise-deployment).

## Development

The mod has no npm dependency installation or build step. For development, use a compatible Claude Code CLI, Node.js 20+, and Python 3.9+.

```bash
npm test
npm run test:eval
npm run test:mod
npm run validate
npm run test:host
```

Additional checks and evaluation tools:

```bash
# macOS: isolated test using a dummy Keychain entry
npm run test:credentials -- --host

# Offline policy replay
python3 scripts/evaluate-advice.py --policy-replay --split all
```

Live evaluation is opt-in and can generate provider charges. Refer to the [evaluation guide](docs/benchmark.md) before running it. Offline tests validate policy and integration behavior but do not establish live recommendation accuracy.

## Documentation

| Guide | Description |
| --- | --- |
| [Installation](docs/INSTALL.md) | Complete setup, credential methods, and enterprise configuration |
| [Agent setup](docs/AGENT_SETUP_PROMPT.md) | Copy-paste instructions for an installation agent |
| [Security](SECURITY.md) | Draft data flow, credentials, and security guidance |
| [Extending Model Pilot](docs/extending.md) | Model profiles, provider adapters, and extension points |
| [Evaluation](docs/benchmark.md) | Methodology for testing suggestions and quality requirements |
| [Validation](docs/validation.md) | Validation approach and evidence |
| [Benchmark results](docs/benchmark-results.md) | Historical measurements and their limitations |

## Contributing

Issues, bug reports, and pull requests are welcome. Please review [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. For vulnerabilities or sensitive reports, follow [SECURITY.md](SECURITY.md).

## License

See [LICENSE](LICENSE) for license details.
