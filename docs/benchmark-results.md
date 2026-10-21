> **0.6 note:** The live model/effort findings below are historical. Version 0.6 changes the product to explicit-acceptance advice and adds a mandatory-quality question to Jev. It does not claim new live recommendation accuracy. See [0.6 validation](validation.md) and the [48-case evaluation guide](benchmark.md).

# Live benchmark results — 22 October 2026

The run completed **131/131 sessions and all 146 answer turns** using the pre-0.5.0 plugin. The terminal printed `131/131` when the last session started; it was still answering four planning prompts. That final Opus/max session took **382.1 seconds**. It did not hang.

All **120 direct model answers were semantically correct**. **97/120 obeyed the JSON-only instruction**. The other 23 contained the correct answer but included prose (12) or a Markdown code fence (11). All requested model/effort combinations reached the observed request and matched the response model. The provider’s internal effective effort is not independently exposed.

The original grader accepted standalone code fences and rejected correct JSON preceded by prose. This report re-scores the same saved outputs with separate correctness and formatting checks. It makes no additional model calls. One unambiguous schema object is recoverable for semantic evaluation; multiple objects, duplicate keys, or competing malformed objects are rejected. The original evidence is preserved locally. [Sanitized aggregate evidence](../benchmarks/results/2026-10-22.json) records its SHA-256 and contains no session identifiers, local paths or raw transcripts.

## Which combinations performed best?

- **Lowest observed cost with correct answers:** Haiku/medium, $0.001616 for six tasks. Only 2/6 answers were bare JSON, so it did not win format compliance.
- **Lowest observed cost with both correctness and JSON-only compliance:** Haiku/xhigh, 6/6, $0.002196 total; median answer latency 3.809 seconds.
- **Fastest median latency among combinations passing every correctness and format check:** Opus/xhigh, 2.454 seconds; $0.039344 total.
- **Fastest median regardless of format:** Fable/high, 1.644 seconds; 5/6 bare JSON and $0.118920 total.
- **No semantic winner:** every combination scored 6/6. These tasks were too easy to reveal a capability advantage for the larger models. Higher effort did not consistently improve formatting.

These are observed results on six short tasks with one trial each, not statistically reliable deployment rankings. Small cost differences can reflect provider cache reuse and output variation. Do not conclude that medium is intrinsically cheaper than low, or that xhigh is needed for routine extraction.

## All model and effort combinations

Costs are the total for six tasks, not per answer. Latency is median wall time for each answer, excluding CLI startup. Every row has six valid dispatches and six semantically correct answers.

| Model | Effort | Correct | Bare JSON | Formatting failures | Median seconds | Claude USD |
|---|---|---:|---:|---:|---:|---:|
| haiku | low | 6/6 | 5/6 | 1 | 2.990 | 0.001811 |
| haiku | medium | 6/6 | 2/6 | 4 | 3.643 | 0.001616 |
| haiku | high | 6/6 | 5/6 | 1 | 3.578 | 0.001666 |
| haiku | xhigh | 6/6 | 6/6 | 0 | 3.809 | 0.002196 |
| haiku | max | 6/6 | 6/6 | 0 | 6.628 | 0.004319 |
| sonnet | low | 6/6 | 5/6 | 1 | 4.389 | 0.020922 |
| sonnet | medium | 6/6 | 5/6 | 1 | 3.994 | 0.026381 |
| sonnet | high | 6/6 | 5/6 | 1 | 4.130 | 0.018168 |
| sonnet | xhigh | 6/6 | 4/6 | 2 | 3.002 | 0.022482 |
| sonnet | max | 6/6 | 6/6 | 0 | 4.856 | 0.029649 |
| opus | low | 6/6 | 4/6 | 2 | 2.255 | 0.035387 |
| opus | medium | 6/6 | 5/6 | 1 | 2.973 | 0.037492 |
| opus | high | 6/6 | 5/6 | 1 | 2.441 | 0.044674 |
| opus | xhigh | 6/6 | 6/6 | 0 | 2.454 | 0.039344 |
| opus | max | 6/6 | 4/6 | 2 | 4.657 | 0.068590 |
| fable | low | 6/6 | 4/6 | 2 | 2.086 | 0.071551 |
| fable | medium | 6/6 | 4/6 | 2 | 2.731 | 0.102097 |
| fable | high | 6/6 | 5/6 | 1 | 1.644 | 0.118920 |
| fable | xhigh | 6/6 | 5/6 | 1 | 2.264 | 0.091601 |
| fable | max | 6/6 | 6/6 | 0 | 4.141 | 0.135055 |

## Jev routing

Jev was called once for each of the six tasks and reported **4,069 classifier tokens** in total. However, **all six responses were rejected/abstained by the adapter**, so all six requests stayed on the initial Opus/high profile and no model changes were attempted. The final answers were correct in all six cases; five were bare JSON.

This is a routing acceptance problem, not evidence that Jev picked the wrong family six times. That benchmark did not retain the raw labels, confidence/probabilities or a detailed rejection reason, so this run cannot identify the rejection cause or assess the rejected recommendations. It also cannot demonstrate routing savings. Keeping the original model when classification is uncertain preserved answer quality.

## Opus planning continuity

All **20 planning turns** preserved Opus and the selected effort, including the simple HTTP aside and the return to the original plan. All five final turns recalled the plan codename. There were **zero Jev calls and zero routing attempts** in these planning sessions.

| Effort | Protected turns | Total answer seconds | Claude USD |
|---|---:|---:|---:|
| low | 4/4 | 17.1 | 0.079328 |
| medium | 4/4 | 23.3 | 0.082236 |
| high | 4/4 | 17.2 | 0.074862 |
| xhigh | 4/4 | 21.7 | 0.082941 |
| max | 4/4 | 382.1 | 0.920551 |

Opus/max was about **22× slower and 12× more expensive than high** in this particular four-turn exercise. The benchmark scored continuity and codename recall, not the depth or security correctness of each plan. It therefore does not prove that high and max delivered equivalent planning quality. Preserve a user’s chosen effort during planning; suggest a change only at a clear task boundary.

## How recommendations should improve

1. **Diagnose abstentions before relaxing safeguards.** Record bounded labels, confidence summaries, provider status and explicit rejection reasons. Do not record API keys, full prompts or raw provider bodies. Re-run the six router cases with this visibility before claiming a live fix. The [targeted rerun below](#targeted-live-rerun--model-pilot-050) now provides that evidence for two applied simple routes and four explained abstentions.
2. **Separate classification from policy.** Jev supplies task characteristics; a configurable policy chooses model and effort. Keep ongoing planning, manual choices, dependent follow-ups and warmed context protected. Do not turn small evaluation wins into automatic global downgrades.
3. **Measure output constraints separately.** Machine-readable output is a workload requirement. The same meaningful answer can still fail an integration if it has commentary or fences. Use structured output support where available; do not silently retry, reformat or switch models without counting the added cost.
4. **Calibrate on representative tasks.** Add enterprise code editing with executable tests, debugging across files, tool use, longer contexts, security/architecture review and deliberately ambiguous prompts. Include held-out variants and repeat trials before changing thresholds or default profiles.
5. **Optimize measured quality, latency and full cost together.** Include Jev charges, classifier latency and cache effects. Separate safe abstention rate, accepted classification accuracy, route application, answer correctness and format compliance. Fable and max should remain explicit options until demanding workloads show a benefit.

## Cost and limitations

Total reported Claude cost was **$2.180765**: matrix $0.873923, routed tasks $0.066924, planning $1.239918. TypeSafe monetary charges were not available and are excluded. No net savings claim is supported.

The six tasks cover record extraction, integer arithmetic, JavaScript behavior, interval boundaries, a constrained schedule and a transaction invariant. There was one sample per combination, no tool execution and no long autonomous coding. Prompts were identical across combinations and shuffled with a fixed seed; provider caches still influenced cost and speed. The continuity corpus tested retention, not whether the plans were production-ready.

For methods, supported tiers and the official Anthropic sources, see [benchmark methodology](benchmark.md). For future runs, the runner now prints per-answer progress and 30-second elapsed-time updates, and enforces its existing response deadline.

## Targeted live rerun — Model Pilot 0.5.0

On 22 October 2026, a fresh live run completed **6/6 router sessions** using the released **0.5.0** package and plugin. Every recorded source-file hash matches release commit `4dce72fb0a1255e4abd23e9bbe4f79f8bb08b60d`; the source manifest fingerprint also matches. [Sanitized follow-up evidence](../benchmarks/results/2026-10-22-router-0.5.0.json) preserves the aggregate metrics and bounded diagnostic signals. The original baseline above remains unchanged.

All **six answers were correct and strict JSON**. Both simple tasks were accepted by Jev and actually changed from Opus/high to **Haiku/low**. For each change, the independent request observer, routing trace and returned API model agreed, with one dispatch attempt and one confirmed model change. There were no accepted recommendations that failed to apply.

The other **four tasks abstained and kept Opus/high**. Their complexity confidence and selected-label probability were below the unchanged **0.95 / 0.95** acceptance thresholds. Independence was scored 1.0 in every case, so context dependence did not cause these abstentions. The diagnostics now explain why these routes stayed unchanged.

| Task | Corpus label | Jev raw label | Confidence | Selected probability | Outcome | Confirmed model / requested effort |
|---|---|---|---:|---:|---|---|
| transaction_invariant | complex | routine | 0.40 | 0.55 | Abstained; kept | Opus 5.5 / high |
| extract_records | simple | simple | 0.97 | 0.98 | Accepted; changed | Haiku 5.5 / low |
| integer_arithmetic | simple | simple | 1.00 | 1.00 | Accepted; changed | Haiku 5.5 / low |
| javascript_trace | routine | routine | 0.79 | 0.84 | Abstained; kept | Opus 5.5 / high |
| constrained_schedule | complex | complex | 0.80 | 0.85 | Abstained; kept | Opus 5.5 / high |
| interval_boundaries | routine | routine | 0.72 | 0.79 | Abstained; kept | Opus 5.5 / high |

Raw complexity labels matched the corpus **5/6 times**. The write-skew transaction question was labeled routine instead of the corpus’s complex label, with only 0.40 confidence and 0.55 selected probability; it was rejected, preserving Opus. A bounded textbook question can be different from reviewing a production transaction design, so this disagreement warrants clearer labels and more examples, not an automatic decision to trust either label on every related task.

The strict routing benchmark reports **2/6 passes** because it requires both an accepted expected classification and the expected profile. That does not mean four answers failed or four model applications broke: all four were explicit safe abstentions. The requested profile matched the corpus profile in **4/6** cases because the two complex tasks were already on Opus/high. Actual observed requests, trace requests and returned API models agreed in **6/6** cases.

Observed answer-turn wall time totaled **15.700 seconds**, with a **2.2345-second median**. Claude cost totaled **$0.0258539**. Jev was called **six times** and reported **4,771 classifier tokens**. TypeSafe monetary charges are unavailable. These measurements include the classifier’s contribution to answer latency but exclude CLI startup; they do not establish net savings against the earlier run.

This was a **router-only rerun**. It did not rerun the 120-answer model matrix or the 20 planning-continuity turns; the earlier continuity evidence remains the basis for that finding.

### Next calibration step

Keep the current acceptance thresholds and planning protections. The fresh run confirms that accepted simple routes can be applied correctly and that low-confidence decisions fail safely, but a six-task sample is too small to justify loosening the thresholds. Build a larger labeled calibration set with held-out task variants, repeated Jev calls, and separate examples of bounded code reasoning versus production-impacting work. Measure accepted-label accuracy and coverage by class, risky downgrade rates, actual route application, answer quality and formatting separately. Evaluate proposed thresholds offline on those held-out cases before enabling a change. Continue to preserve manual model/effort choices and ongoing planning.
