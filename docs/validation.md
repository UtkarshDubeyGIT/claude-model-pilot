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
