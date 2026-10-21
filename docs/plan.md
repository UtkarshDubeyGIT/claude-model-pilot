# Model Pilot plan

## Product promise

Help Claude Code users choose an appropriate model and reasoning effort with little interruption. Preserve the quality and continuity of ongoing work. Savings are a hypothesis to evaluate, not a guarantee.

The mod should usually stay quiet. It should explain a meaningful recommendation briefly, offer an explicit way to apply it, and respect a user's choice to keep the current model. A short follow-up during a complex plan is part of that plan unless there is strong evidence of a separate task.

## MVP

1. Read draft and submitted prompts through native mod events.
2. Ask TypeSafe Jev to classify eligible submitted tasks, then map accepted decisions to model/effort profiles.
3. Show a compact explanation; use `/model` for manual application and `/route` for mode, task boundary, and lock controls.
4. Keep the selected execution profile stable throughout a turn.
5. Provide optional automatic routing with conservative downgrade rules.
6. Count observed usage and hold the last routing decision in session memory, with no durable prompt analytics.

Jev is the default decision provider. Local rules supply continuity and safety constraints; they do not replace a missing Jev decision. Haiku classification and local-only routing are explicit alternatives. Classifier calls are bounded and separately counted. Do not call a provider on every keystroke or send full conversation history.

## Decision policy

- Preserve manual locks and explicit model choices.
- Retain the current model during planning, complex debugging, ongoing implementation, and ambiguous continuations.
- Avoid downgrading based only on prompt length or words such as “yes,” “continue,” or “fix.”
- Treat attachments and unknown model capabilities conservatively.
- Prefer a new task boundary for model changes; account for the cost of rebuilding a warm cache.
- Respect organization model and effort restrictions. Unknown deployment details are a reason to retain the current profile.
- On router failure, continue ordinary Claude Code behavior. Do not retry an already-issued model request merely because the routing layer failed afterward.

## Staged rollout

**Development:** validate the mod against local CLI 2.1.303, exercise integration tests, and document the supported client surface. Cover manual overrides, turn stability, plan continuation, queued prompts, subagents, session reset/resume, malformed classifier output, and cancellation.

**Shadow pilot:** compute recommendations without changing execution. Use a small, representative internal cohort and collect voluntary feedback on incorrect or distracting advice. Establish an unmodified baseline for the same kinds of work.

**Assisted pilot:** let users explicitly apply recommendations. Track acceptance, reversals, recovery after weak answers, and whether the original task succeeded. Compare against baseline while separating task mix and session length.

**Limited automation:** enable automatic changes only for categories that pass the quality gate. Retain a visible override and an immediate way to disable automation. Expand by task category and provider after evidence supports it.

**Public release:** publish the tested-version matrix, known limitations, privacy behavior, and evaluation method with the open-source package. Repository publication and organization-wide installation are separate release actions.

## Evaluation gate

Do not enable automatic downgrades broadly until a reviewed task set shows acceptable quality and a real net benefit. Choose the acceptance thresholds with the enterprise pilot owners before evaluation; do not tune them after seeing the results.

Measure these outcomes separately:

| Outcome | Evidence |
| --- | --- |
| Task quality | Passing project checks, reviewer assessment, rework, and task completion |
| Tokens | Actual uncached input, cache reads/writes, and generated output, including classifier calls |
| Money | Provider or contracted rates applied to observed usage; distinguish estimates from invoices |
| Latency | Time to first useful response and total task completion time |
| Friction | Dismissals, manual switches, repeated suggestions, and interruptions |
| Stability | Unwanted switches during a task, policy failures, and routing errors |

Use paired tasks or a controlled comparison where practical. A token-rate comparison alone cannot demonstrate savings, and a faster first reply can still increase total task time through rework. Preserve results that contradict the routing hypothesis. Until the pilot passes, describe the product as a model adviser with experimental automatic routing.

## Extensible decision pipeline

System One means a purpose-built decision model such as TypeSafe's Jev. Eligibility, typed provider questions, acceptance policy, profile mapping and host application remain separate modules. Uncertainty, timeout or a missing key preserves the current selection. Future profile changes require representative evaluations and must not weaken planning continuity. See [extension boundaries](extending.md) and [the live benchmark findings](benchmark-results.md).
