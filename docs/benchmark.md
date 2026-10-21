# Current-tier model and effort benchmark

Documentation checked on 22 October 2026. This benchmark covers the current general-purpose Claude lineup, not every historical version or restricted specialized model.

| Tier / pinned model | Documented purpose | API default effort |
| --- | --- | --- |
| Haiku 5.5 / `claude-haiku-5-5` | High-volume, low-latency classification, extraction and routing | medium |
| Sonnet 5.5 / `claude-sonnet-5-5` | Speed/capability balance; scoped coding and general work | high |
| Opus 5.5 / `claude-opus-5-5` | Complex reasoning, sustained coding and knowledge work | medium |
| Fable 5.1 / `claude-fable-5-1` | Demanding reasoning and long-horizon agentic work | high |

Source: [Anthropic model overview](https://platform.claude.com/docs/en/about-claude/models/overview). Account availability can differ; the benchmark records failures rather than assuming every model is accessible.

All four support `low`, `medium`, `high`, `xhigh` and `max`. Lower effort emphasizes speed and token efficiency. Higher effort is useful when additional reasoning improves the task's outcome. Anthropic recommends a fresh effort sweep for current models; Sonnet medium is a starting point for well-specified agentic work, while harder work can justify high. Fable starts at high. The API defaults above are not universal workload recommendations. Numeric effort values and the implicit default are not extra named tiers in this sweep. Source: [effort documentation](https://platform.claude.com/docs/en/build-with-claude/effort).

Claude Code enterprise policies can cap effort, and host fallback can change the model. A read-only benchmark observer captures the model and effort reaching `turn.step` and the model reported in the response. A cap, fallback, truncation, missing observation, or model error invalidates attribution to the requested cell. The provider's internal effective reasoning effort is not independently exposed. Source: [Claude Code model configuration](https://code.claude.com/docs/en/model-config).

## What runs

- **120 direct answers:** six identical scored tasks × four models × five efforts. Model Pilot is off. The tasks cover structured extraction, integer arithmetic, JavaScript semantics, interval boundaries, constrained scheduling and transaction invariants.
- **Six routed answers:** the same corpus with Jev and automatic routing enabled, initially on Opus/high. Jev's labels, policy result, outgoing profile, observed model, classifier token reports and answer correctness are retained separately.
- **20 planning answers:** a four-turn Opus session at each effort level. Follow-ups, a simple aside, and a return to the plan must retain the chosen model and effort. The final turn must recall the plan's codename.

Total: **131 sessions, 146 answer turns** with one repetition. `--repeats 3` runs 398 answer turns, keeping the continuity suite once. Order within the matrix is seeded and shuffled. A fixed corpus and pinned model IDs make comparisons reproducible. This is a short-task benchmark; it does not measure the long autonomous projects for which higher tiers and efforts may be most useful.

The current router can select only Haiku/low, Sonnet/medium or Opus/high. The full matrix measures alternatives; it does not silently enable Fable or change routing policy. Model metadata and tasks live in `benchmarks/models.json` and `benchmarks/tasks.json`, independently of the runner.

## Run

From the shell holding `TYPESAFE_API_KEY` and Claude authentication:

```sh
python3 scripts/benchmark.py --budget-usd 10
```

To check Jev alone after a routing or classifier change, run the same six tasks without repeating the 120-answer model sweep:

```sh
python3 scripts/benchmark.py --section router --budget-usd 1
```

`--section matrix` and `--section continuity` select the other suites. Section selection is part of the run fingerprint; resume with the same section. The router suite asserts the published default profiles (Haiku/low, Sonnet/medium, Opus/high), using both the independent observer and the routing trace. An accepted Jev label alone does not count as a successful application.

The default is a **soft $10 stop based on reported Claude cost**, with a $1 session budget. TypeSafe monetary cost is excluded. An in-flight request can exceed the threshold; this is not a guaranteed billing cap. Sessions run sequentially, without automatic request retries. Missing cost or an interrupted session stops additional work. The host can still perform its own retries or fallback.

For a stronger repeated comparison:

```sh
python3 scripts/benchmark.py --repeats 3 --budget-usd 10
```

Inspect the matrix without making calls:

```sh
python3 scripts/benchmark.py --dry-run
```

Validate the whole pipeline with a real Claude executable and synthetic responses:

```sh
python3 scripts/benchmark.py --offline
```

New runs record package/plugin versions and SHA-256 fingerprints of relevant source, hook and corpus files. Resume refuses to mix different recorded source versions.

Each run writes timestamped JSON and Markdown under `evals/`, checkpoints after every session, and preserves previous results. Per-answer progress explains which turn is waiting; high-effort planning can take several minutes even when the session counter says 131/131. To continue an interrupted run, pass its JSON path with `--resume`; retain its seed, repeat count, corpus and offline/live mode. Raise `--budget-usd` if the previous run reached its budget. A failed recorded session remains failed; resuming does not replay it. `--limit` is available for small harness smoke tests.

## Interpreting results

The table separates attempted sessions from valid model/effort observations, semantic correctness, strict JSON-only compliance, and formatting-only failures. Bare JSON is compliant; Markdown fences and extra prose are not. One unambiguous object can be recovered to evaluate meaning, but multiple objects, duplicate keys, or competing malformed objects are never cherry-picked. Scores are deterministic; scheduling also checks precedence, worker capacity and optimal completion time rather than trusting the model's claim. These tests do not execute generated code. No LLM judge decides its own correctness.

Latency covers the submitted answer turn, including Jev where enabled, but excludes CLI startup and setup commands. Full usage and cache categories are retained. Fresh sessions prevent conversation leakage, but identical prompts may still benefit from provider caches; inspect cache usage before making cost claims. Within the four-turn continuity runs, cost is computed as a delta of cumulative session cost, avoiding double-counting.

The report selects a lowest observed Claude-cost combination only when that combination completed and passed the full corpus. A single repetition, six short tasks, and unknown TypeSafe monetary overhead cannot establish statistical significance or net enterprise savings. A real recommendation change requires representative enterprise tasks, repeated trials, quality review and broader tool-loop tests. Synthetic offline reports never recommend a winning model.


## Re-score existing evidence

To separate answer correctness from JSON-only formatting without new model calls:

```sh
python3 scripts/benchmark.py --rescore evals/your-run.json
```

This writes separate `.rescored.json` and `.rescored.md` files, preserves the original answers and scores, and records the source SHA-256. It verifies the source corpus/catalog fingerprint first and refuses to overwrite an existing derived result. Published aggregate evidence contains no raw session logs, local paths or identifiers. See [the October 2026 results](benchmark-results.md).
