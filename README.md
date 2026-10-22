# Model Pilot — Claude Model Router Mod

**Jev-powered model and effort advice before you send. You decide whether to use it.**

Model Pilot recommends a better **quality–cost tradeoff** when there is enough evidence. It can suggest a smaller model, stronger reasoning, or a different effort on the same model. Speed is secondary. Reduced depth or polish may be acceptable; correctness, safety, required functionality and output format remain requirements.

**0.6.3 experimental · MIT · tested with Claude Code 2.1.306.** Independent of Anthropic and TypeSafe. Advice is a prediction, not a guarantee of answer quality or savings.

## Install

```sh
claude plugin marketplace add UtkarshDubeyGIT/claude-model-router-mod
claude plugin install model-pilot@model-pilot-marketplace --scope user
```

Create a key in the [TypeSafe console](https://console.typesafe.ai). Enter it privately in **zsh**, then launch Claude from the same shell:

```zsh
read -rs 'TYPESAFE_API_KEY?TypeSafe API key: '
export TYPESAFE_API_KEY
printf '\n'
claude
```

**Advice is enabled by default. Eligible unfinished drafts are sent to TypeSafe after you stop editing, even if you never send them to Claude.** TypeSafe charges are separate. The mod keeps drafts and cached assessments only in session memory; it does not write prompt logs. `/route off` stops new assessments. Never paste a key into chat or a command argument.

[Full installation guide, including Bash](docs/INSTALL.md) · [Copy-paste setup prompt for your agent](docs/AGENT_SETUP_PROMPT.md) · [Security disclosure](SECURITY.md)

## Verify that advice can run

Run `/route status` in Claude after installation. It reports the current protection, whether the key is present (not whether authentication succeeded), permission state, and the last assessment reason. No API call is made by this command.

- **Ongoing task protected:** Jev is deliberately skipped. Finish that task, then use `/route new` only when starting an independent task. Follow-ups, asides and related implementation remain protected.
- **Permission state is unknown:** this also occurs in a fresh interactive terminal on the tested host, even when its footer says “auto mode on.” The mod waits for authoritative lifecycle state, which may arrive only with the first normal answer. After finishing that task, use `/route new`. Do not bypass the guard.
- **Key missing:** restart Claude from the shell where you exported the key.
- **No card after an eligible assessment:** the current profile may fit, Jev may abstain, or context reload may outweigh savings. `/route trace` distinguishes these. A suggestion is not a loading indicator.

For a small test, use a separate, low-context session. After permission state is known and the initial task is complete, run `/route new`, type `What does HTTP stand for?`, and pause without sending. A card requires a suitable current profile and confident live Jev evidence; it is not guaranteed. `/route check What does HTTP stand for?` explicitly assesses the same draft and prints the outcome. Both draft assessment and `/route check` use TypeSafe and are separately billed.

Claude’s **“auto mode on” footer controls tool permissions**. It does not mean Model Pilot automatically changes models.

## How it feels

The compact status line uses an emoji compass, a bold model name, muted dividers and state icons, alongside other mods such as Token Weather:

```text
🧭 Model Pilot │ Sonnet · high │ 🔒 task protected │ /route
```

It appears above the composer immediately after loading. Claude controls this band: a survey temporarily takes precedence, and users can collapse/expand it with `ctrl+x ctrl+a`. `/route off` leaves an “off” indicator visible and stops assessment/application.

Pause typing for two seconds. When a change is justified, one compact suggestion appears above the composer with the proposed model/effort, expected benefit, tradeoff, and **Use for this task / Dismiss** buttons. A compact Model Pilot status line remains visible even when there is no recommendation. It shows the current profile and states such as waiting for session state, task protected, assessing draft, insufficient evidence, or off. Rendering the line makes no provider calls. Focus the band with `ctrl+x tab` or click it to use the buttons.

Sending before advice is ready uses your current selection. Accepting authorizes only the displayed recommendation for the matching draft and task. Editing the task draft or changing model, effort, mode or task boundary invalidates unconsumed acceptance. The mod never delays submission to wait for Jev and never replays a started request.

Once the API confirms an accepted model, its requested effort and model remain active for that task's follow-ups. The band displays the active task profile. Saved Claude defaults stay unchanged. The API reports model identity; it does **not** independently verify effective reasoning effort.

**Planning continuity is a hard constraint.** Plan → follow-up → simple aside → implementation → return to plan stays on the task profile. Leaving plan mode, or typing “Unrelated question:”, does not unlock it. `/route new` establishes a new task, but cannot override plan mode or a pin. Resumed sessions protect their host-selected profile; in-memory advice and acceptance do not survive a reload.

The host must expose permission state before assessment. Some hosts, including the tested headless CLI, do so only after the first answer. The status line says “waiting for session state”; no draft is assessed while state is unknown. After finishing that task, `/route new` explicitly starts an eligible task. Do not disable the guard to force advice.

## Commands

| Command | Purpose |
| --- | --- |
| `/route status` | Protections, active profile, provider state and separate counters |
| `/route trace` | Sanitized evidence and application outcome; no draft text |
| `/route profiles` | Initial mappings and deployment IDs |
| `/route accept <id>` | Accept the displayed advice for its matching draft/task |
| `/route dismiss <id>` | Dismiss without changing the request |
| `/route check <prompt>` | Explicitly assess a draft; useful in headless clients |
| `/route advise` / `/route off` | Enable advice / stop new assessments and application |
| `/route pin` / `/route unpin` | Lock / release the current host selection |
| `/route new` | Explicit task boundary; planning and pins still win |
| `/route classifier jev` / `/route classifier off` | Enable / disable Jev assessment |
| `/route auto` | Migration explanation only; automatic changes were removed |

With the command alternative, send the **exact checked draft** after acceptance. Interactive slash acceptance restores it to the composer when possible. Changes invalidate consent. Command text can appear in Claude's own transcript; the mod's trace omits it.

Manual model selection pins advice. `/route off`, a manual override, or a host mismatch releases a mod-applied task profile; subsequent requests use the host selection. This is an explicit override, not a background recommendation.

## Evidence and extensibility

The initial profiles remain **Haiku/low, Sonnet/medium, Opus/high**. Jev evaluates complexity, independence, and whether the mapped candidate can meet mandatory quality requirements. Each answer needs confidence and selected-option probability ≥0.95. Abstention means insufficient evidence—not that the current choice is optimal. Same-model effort suggestions require a reliably observed current effort.

Assessment, task protection, quality/cost comparison and presentation have separate versions. The profile catalog and provider adapter are separate from acceptance and host application. [Extension guide](docs/extending.md)

The historical 120-answer model sweep found **120 semantically correct answers and 97 strict-format passes**. Twenty Opus planning turns retained their selected profiles. Six tiny tasks do not establish a universal best model, effort or savings claim. Fable and higher efforts remain available for benchmarking, not default advice targets. [Historical results](docs/benchmark-results.md)

Version 0.6 adds **24 calibration + 24 held-out scenarios** and measures useful advice, justified silence and mandatory quality separately. Offline tests verify policy and application. They do not establish live Jev accuracy. [Evaluation guide](docs/benchmark.md) · [Validation evidence](docs/validation.md)

## Develop and evaluate

No runtime dependencies or build step. Development needs Node 20+, Python 3.9+ and a compatible Claude Code CLI.

```sh
npm test
npm run test:eval
npm run test:mod
npm run validate
npm run test:host
python3 scripts/evaluate-advice.py --policy-replay --split all
```

Paid calibration is an explicit command:

```sh
python3 scripts/evaluate-advice.py --live --split calibration --answers --budget-usd 5
```

The soft budget covers reported Claude cost, excludes TypeSafe charges, and may be exceeded by an in-flight request. Review calibration before running held-out evaluation. Free-form correctness, code functionality and depth/polish require independent review; unreviewed answers never count as passes.

## Enterprise and migration

Review TypeSafe's unfinished-draft data flow and use approved credentials and model access. Custom gateways and cloud providers need explicit `ANTHROPIC_DEFAULT_{HAIKU,SONNET,OPUS}_MODEL` mappings. Unknown model families, unavailable permission state, attachments and queued prompts fail closed. Follow [enterprise setup](docs/INSTALL.md#enterprise-deployment).

0.6 removes automatic routing and retires the optional Haiku/local-only recommendation paths. `/route classifier off` means no new advice. Trace schema 2 separates suggested, accepted, dispatched and confirmed counts. See [migration and rollback](docs/migration-0.6.md); [v0.5.0](https://github.com/UtkarshDubeyGIT/claude-model-router-mod/releases/tag/v0.5.0) remains available.
