# Model Pilot — Claude Model Router Mod

**Let Jev recommend a Claude model and effort profile without breaking your flow.**

Model Pilot is an open-source Claude Code mod powered by [TypeSafe's Jev](https://docs.typesafe.ai/introduction/quickstart). It evaluates eligible standalone prompts, recommends a model, and can apply that recommendation when you enable automatic routing. Planning, follow-ups and your manual model choices stay protected.

**Experimental. Advisory mode is the default.** Tested with Claude Code **2.1.303**. An independent MIT-licensed project; not affiliated with Anthropic or TypeSafe. Lower cost is a goal, not a guarantee.

## Install

Run in your terminal:

```sh
claude plugin marketplace add UtkarshDubeyGIT/claude-model-router-mod
claude plugin install model-pilot@model-pilot-marketplace --scope user
```

Create a key in the [TypeSafe console](https://console.typesafe.ai). In **zsh**, enter it privately, then start Claude Code from that same terminal:

```zsh
read -rs 'TYPESAFE_API_KEY?TypeSafe API key: '
export TYPESAFE_API_KEY
printf '\n'
claude
```

Inside Claude Code, run `/route status`. Jev is already selected. Begin in advisory mode; `/route auto` enables automatic routing for that session. **With a key configured, eligible prompts go to TypeSafe even in advisory mode.** Never paste a key into a chat, a `/route` command, or a repository file.

[Full setup, Bash instructions and troubleshooting](docs/INSTALL.md) · [Copy-paste setup prompt for your agent](docs/AGENT_SETUP_PROMPT.md)

## What it does

| Task or session | Behavior |
| --- | --- |
| Fresh, independent factual question | Jev can recommend Haiku / low |
| Self-contained routine coding task | Jev can recommend Sonnet / medium |
| Complex or high-impact work | Jev can recommend Opus / high |
| Opus plan → follow-up → simple aside → return to plan | Keep Opus and the selected effort throughout plan mode |
| “Continue,” “implement it,” or ongoing work | Preserve the task's model and effort |
| Manual model switch or `/route pin` | Keep your choice until you unpin |
| Missing key, provider error, uncertainty or hidden context | Preserve the current selection |

Jev classifies **complexity and independence**. A separate policy maps accepted classifications to configurable model/effort profiles; Jev does not directly choose an effort value. The initial profiles are Haiku/low, Sonnet/medium and Opus/high. Higher efforts and Fable are benchmarked, but are not automatic targets by default.

Recommendations happen on submission, never on keystrokes. One decision covers a turn's tool loop. A routed work profile persists for its follow-ups; a simple independent aside does not replace the task profile. You can mark an unrelated prompt with `Unrelated question:` or mark a task boundary with `/route new`. Plan mode and manual pins still take precedence.

## Commands

| Command | Purpose |
| --- | --- |
| `/route status` | Show mode, protections, provider state and observed request |
| `/route trace` | Show the last structured decision and model confirmation |
| `/route profiles` | Show configured model/effort profiles |
| `/route advise` | Recommend; keep your outgoing model and effort |
| `/route auto` | Apply eligible recommendations to future turns |
| `/route off` | Stop recommendations, classification and routing |
| `/route pin` / `/route unpin` | Lock / release your model choice |
| `/route new` | Start a new task; retain any manual pin |
| `/route classifier jev` | Use Jev, the default provider |
| `/route classifier haiku` | Explicitly use Claude Haiku as the classifier instead |
| `/route classifier off` | Use limited local rules, with no classifier calls |

Use Claude Code's `/model` to select a model manually; doing so pins routing. Model Pilot never edits saved model defaults. Reloading the mod or starting another session restores advisory mode with Jev selected. Resumed conversations are protected as ongoing work.

## What the benchmark found

The first live sweep completed **131 sessions / 146 answer turns** across four current tiers and five named effort levels. The 120 direct model answers were semantically correct; **97/120 also met the strict output-format contract**. All 20 Opus planning turns retained their selected model and effort. Jev abstained on all six routed corpus prompts, so those cases stayed on Opus/high and demonstrated no switching savings.

A targeted live rerun of **0.5.0** then confirmed both simple tasks routing to **Haiku/low**. The other four cases safely retained Opus/high because their complexity signals were below the acceptance thresholds. All six answers were correct and strict JSON. This verifies two applied routes; it does not establish general routing accuracy or net savings. The targeted run did not repeat the planning suite.

See the [results and recommendations](docs/benchmark-results.md) and [benchmark guide](docs/benchmark.md). This is one repetition of six short tasks, not evidence of a universal best model or enterprise readiness. TypeSafe monetary overhead is excluded. API-reported identity verifies the model, not the provider's effective reasoning effort.

Switching models can lose prompt-cache reuse. Context limits and a cooldown reduce unnecessary switching; they are heuristics, not a calculation of financial break-even. Existing conversations with missing context measurements remain protected. A verified fresh session can route before its first usage measurement.

## Privacy and enterprise use

Jev receives only the eligible current prompt, at most 4,000 characters, through `https://api.typesafe.ai/v1/systemone`. The mod does not attach history or files, write prompt logs, or send telemetry. Claude Code and the providers retain their own normal data handling. `/route off` stops classification; local-only mode is available without a TypeSafe key. See [security and data handling](SECURITY.md).

Start enterprise pilots in advisory mode with approved providers and model access. Managed deployments can restrict mods or the lifecycle events they receive. If the permission mode is unavailable, Model Pilot protects the session instead of assuming routing is allowed. An organization-managed GitHub install is not automatically an organization-owned mod: Claude's managed-mod rules require an administrator-controlled local marketplace. Follow the [enterprise setup notes](docs/INSTALL.md#enterprise-deployment).

Custom gateways and Bedrock, Vertex or Foundry need explicit `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL` and `ANTHROPIC_DEFAULT_OPUS_MODEL` mappings for the targets you enable. Unknown starting model families remain unchanged. Host restrictions can still reject a target; Model Pilot does not replay a streamed request to retry it.

## Develop and evaluate

The runtime has no package dependencies or build step. Development uses Node 20+, Python 3 and a supported Claude Code CLI.

```sh
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
claude plugin validate --strict .
claude plugin test .
python3 scripts/live-eval.py --offline
```

Offline tests use synthetic model responses; they verify integration, not model quality. Paid evaluation is explicit:

```sh
python3 scripts/live-eval.py
python3 scripts/benchmark.py --budget-usd 10
```

Run paid commands only from a shell with the intended credentials. The benchmark budget is a soft stop on reported Claude cost, excludes TypeSafe charges, and may be exceeded by an in-flight request. Results are saved locally; review and redact before sharing them.

Providers, profile mappings, continuity policy and host application have separate extension points. Read [how to extend recommendations](docs/extending.md) and [contributing](CONTRIBUTING.md). Suggestions and redacted reproductions are welcome in [GitHub issues](https://github.com/UtkarshDubeyGIT/claude-model-router-mod/issues).
