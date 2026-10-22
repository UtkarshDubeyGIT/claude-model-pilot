# Validation record — 0.6.3 experimental

22 October 2026, Claude Code **2.1.306**. Visual-only update: segmented status row, emoji icons, muted dividers, bold model name and narrow-terminal wrapping. All 165 existing automated tests passed (85 portable, 49 native, 31 Python); native display expectations were updated for the segmented row on terminal and desktop. Strict validation passed with the existing optional icon warning. The isolated interactive terminal rendered the styled startup line with zero model requests. Recommendation policy and request application are unchanged; the prior synthetic integration results below are from 0.6.2, not a new live-provider test.

---

# Validation record — 0.6.2 experimental

22 October 2026, Claude Code **2.1.306**. This patch adds a persistent composer status line; it does not change recommendation or application policy.

- 85 portable tests, 49 native mod tests and 31 Python tests passed (165 total). Five new native tests first failed with the old conditional UI, then passed with persistent status. They cover terminal/desktop startup without draft or provider calls, protected/off states, assessment-to-abstention transitions, stale draft status, missing keys and dismissal without consent. Other mods' rendered content remains present.
- Strict validation passed with the existing optional listing-icon warning. All four real-host synthetic scenarios passed, including Opus planning continuity.
- An isolated interactive terminal displayed the status line before any prompt or command, showing the host model and unknown session state with zero model requests. This is display verification, not live Jev calibration.

The host owns band collapse and survey precedence; either can temporarily hide the line. A visible line confirms the mod loaded, not successful TypeSafe authentication. All model/provider integration responses were synthetic; no new savings or recommendation-quality claim is made.

---

# Validation record — 0.6.1 experimental

22 October 2026, Claude Code **2.1.306**. This patch improves diagnosis and installation instructions; it does not relax recommendation gates or task protection.

- 85 portable tests, 44 native mod tests and 31 Python tests passed (160 total). Four new native tests first reproduced missing explanations for unknown permission, ongoing tasks, missing keys and context-cost suppression, then passed with the patch.
- Strict plugin validation passed with the existing optional listing-icon warning.
- Real-host synthetic integration passed all four scenarios (seven answer turns), including protected Opus planning.
- An isolated interactive terminal reproduced silent first-draft assessment with `Permission state is unknown`. The patched status exposed the reason without a Jev call. After a normal synthetic answer and an explicit new task boundary, typing a simple draft showed the Haiku/low suggestion and both buttons.

All provider/model responses in these checks were synthetic. The new diagnostics report key presence only, not successful authentication. Live Jev quality calibration remains outstanding. No private drafts or raw session logs are included here.

---

# Validation record — 0.6.0 experimental

22 October 2026, Claude Code **2.1.306**. Synthetic fixtures use an isolated temporary configuration, a loopback model API and dummy credentials; no paid inference was used for this release validation.

| Check | Result | What it establishes |
| --- | --- | --- |
| Portable Node tests | 85 passed | Policy, consent ledger, provider validation, 48 labeled scenario replays |
| Native mod tests | 40 passed | Draft timers, races, explicit consent, buttons, overrides, mappings, tool loops and continuity |
| Python tests | 31 passed | Independent correctness/format grading, evaluation integrity and budgets |
| Strict plugin validation | Passed | Supported hook/capability syntax and manifests |
| Real-host synthetic integration | 4 scenarios / 7 answer turns passed, plus 3 initialization answers | Explicitly accepted Haiku/low, Sonnet/medium and Opus/high; four protected Opus planning turns |
| Real-host synthetic continuity | 5 sessions / 20 turns passed | Opus low, medium, high, xhigh and max retained exactly |
| Interactive terminal composer | Verified with synthetic provider/model responses | Idle suggestion, button acceptance, request application and follow-up retention |

Native tests additionally cover the full plan → follow-up → aside → implementation → return chain at every effort, resumed-session protection, stale responses, changed drafts, API mismatches, unknown permission state, attachments and queues. No automatic routing mode exists.

The interactive check found and fixed a real-host ordering difference: the composer emits a clear immediately before submission. Consent can transfer during that same dispatch cycle; a standalone clear expires on the next timer tick, while edits invalidate immediately. Both event orders and standalone clear have regression tests. The tested UI sent Haiku/low only after acceptance, displayed the confirmed active task profile, and retained Haiku/low for “Continue.” The host can make its own background model calls; the mod's counters and main-request trace are the application evidence.

The 48-case **synthetic policy replay** produced 20 useful-advice outcomes and 28 justified silences under authored, high-confidence labels. That checks policy behavior, not live Jev accuracy or calibration. The 24/24 split is fixed; live held-out results have not been collected. No new savings or general model-quality claim is made.

## Limits

- Jev question version 3's mandatory-quality check has not yet been live-calibrated. Run the explicit paid calibration command before relying on recommendation accuracy in an enterprise workload.
- The native API can withhold permission state until the first answer. Unknown state stays protected. After a completed task, `/route new` enables assessment only when other protections allow it.
- Effective provider-internal effort is not independently reported. The trace verifies requested effort and API-reported model identity.
- Volatile acceptance/profile state does not survive reload. Resumed sessions protect the host-selected profile.
- Desktop buttons were tested through the native surface harness; actual terminal composition was tested interactively. Other clients and enterprise-managed deployments need their own checks.
- Strict validation reports an optional missing directory-listing icon; that does not block GitHub marketplace installation. GitHub publication is not Anthropic directory approval.

Sanitized aggregates and source hashes: [0.6 validation evidence](../benchmarks/results/2026-10-22-advisor-0.6.0.json). Raw synthetic logs remain local and ignored. Previous live evidence below applies to 0.5, not the new rubric.

---

# Validation record — 0.5.0

22 October 2026, Claude Code 2.1.303. This is an experimental release.

## What is verified

- Portable policy and provider-adapter tests cover conservative classification, exact labels, validated probabilities, safe diagnostics and configurable profile boundaries.
- Native mod tests exercise outgoing model/effort rewriting, model confirmation, provider failures and timeouts, fresh/resumed sessions, gateway mappings, manual choices, queued prompts and planning continuity.
- Python tests check the evaluation harness, semantic versus formatting scores, malformed answers, progress/deadlines and result attribution.
- The real Claude Code offline suite passes all seven synthetic-response turns: three standalone routes and four protected Opus/high planning turns. A loopback API independently observes the exact full model IDs and effort fields. These are integration tests, not model-quality measurements.
- Strict production plugin/marketplace validation passes. The optional listing-icon warning does not affect local or GitHub marketplace installation. Static validation is not Anthropic directory approval or an enterprise security review.

Run the commands in [CONTRIBUTING.md](../CONTRIBUTING.md) to reproduce the checks. CI runs the portable suites on Node 20 and 22 with Python 3.11; native host validation is a separate local check.

## Live evidence before this release

An earlier seven-turn real-provider test verified Jev's simple/routine/complex routes to Haiku/low, Sonnet/medium and Opus/high, followed by four protected Opus/high planning turns. This followed fixes for missing context measurements blocking classification and unresolved aliases being sent to the model API.

The broader benchmark then completed 131 sessions and 146 answer turns. All 120 direct matrix answers were semantically correct, 97 met the strict JSON-only requirement, and all 20 planning turns preserved their chosen Opus profile. All six routed corpus cases called Jev but abstained before dispatch. The old trace did not explain why they abstained. The public [results and limitations](benchmark-results.md) and [sanitized aggregate](../benchmarks/results/2026-10-22.json) are the authoritative record.

## Live verification of 0.5.0

This release adds explicit abstention reasons, bounded provider signals, a revised task rubric and inspectable profiles. It retains the 0.95 gates and existing default profiles. A failed optional Haiku classifier now preserves the model instead of falling back to local keyword guesses.

A targeted live run completed all six routed corpus cases against the exact released implementation: every recorded source hash matched release commit `4dce72fb0a1255e4abd23e9bbe4f79f8bb08b60d`. Jev 1.13.0 accepted the extraction and arithmetic tasks as simple; independent request observations and API identity confirmed both Haiku/low routes. The other four responses had complexity confidence and selected-option probability below 0.95, so they remained on Opus/high. All six answers were semantically correct and bare JSON. Total reported Claude cost was $0.0258539, excluding TypeSafe charges.

The raw complexity choice matched the benchmark label in five cases. The transaction-invariant case favored routine over the benchmark's complex label at low confidence; the gate prevented a downgrade. Matching a task label alone is not proof that a model is optimal. These six observations do not justify weakening thresholds. The router-only run did not repeat planning; planning evidence remains the earlier 20 live turns plus the complete offline suite.

See the [sanitized rerun evidence](../benchmarks/results/2026-10-22-router-0.5.0.json) and the [detailed findings](benchmark-results.md#targeted-live-rerun--model-pilot-050). Raw evaluation logs remain local and ignored by Git; no API key or user transcript is needed in a public bug report.

API-reported identity confirms the response model. Tests observe the requested effort, not the provider's internal effective reasoning. No net token savings, monetary savings, general capability ranking or production readiness is claimed.
