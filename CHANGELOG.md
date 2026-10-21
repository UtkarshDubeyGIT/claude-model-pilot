# Changelog

## 0.5.0 — 2026-10-22

- Add public marketplace installation instructions, secure shell setup, troubleshooting, contributor guidance and a copy-paste agent setup prompt.
- Report benchmark answer correctness separately from strict output-format compliance. The first live matrix contains 120 semantically correct answers, with 97 strict format passes; all 20 planning turns retained Opus and the selected effort.
- Require independent evidence that the expected route was applied, reject malformed schedule answers safely, and preserve source/version fingerprints in new benchmark runs.
- Add targeted benchmark sections and elapsed-time progress so long final sessions remain understandable.
- Preserve sanitized Jev Choice signals and rejection reasons when the provider abstains. Version the question rubric and acceptance policy separately; keep the 0.95 acceptance gates unchanged.
- Clarify Jev's rubric for mechanical work, code reasoning, interacting constraints and task independence. A post-release six-case live rerun of the unchanged 0.5.0 source confirmed both simple routes to Haiku/low, with four conservative abstentions and six correct, strictly formatted answers. Broader calibration remains necessary.
- Add `/route profiles` to expose versioned profiles and resolved model IDs. Existing routing profiles and Opus planning protections stay unchanged.
- Preserve the selected model if the optional Haiku classifier fails or abstains. Sanitize classifier usage counters before displaying them.
- Document that the six expanded-benchmark routing cases all abstained; no switching or net savings was demonstrated in those cases.

## 0.4.1 — 2026-10-22

- Add a reproducible four-model, five-effort benchmark with six scored tasks, routed cases and planning continuity at every named effort level.
- Save timestamped progress, observe actual model/effort application and expose soft cost limits.

## 0.4.0 — 2026-10-22

- Separate classification eligibility from context-cost policy so eligible fresh tasks can reach Jev before usage measurements exist.
- Apply full model IDs or explicit deployment mappings instead of unresolved aliases.
- Distinguish dispatch attempts from API-confirmed routes and preserve continuity only after confirmation.
- Add structured traces and real-host offline tests. A seven-turn live integration test verified three standalone routes and four protected Opus planning turns.
