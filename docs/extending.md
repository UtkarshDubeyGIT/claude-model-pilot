# Recommendation extension boundaries

The pipeline is **Jev assessment → task protection → quality/cost comparison → presentation**. Task protection also runs before provider transport, and consent/protection is rechecked at submission and dispatch.

| Component | Source | Version |
| --- | --- | --- |
| Jev questions and typed evidence | `src/jev.js` | question 3; gates 1 |
| Task protection | `src/policy.js` | 2 |
| Quality/cost comparison | `src/policy.js` | 2 |
| Consent ledger and presentation | `src/advisor.js`, `hooks/register.js` | 1 |
| Initial candidate mappings | `src/profiles.js` | 1 |
| Trace | `/route trace` | schema 2 |

Jev receives the eligible draft and candidate catalog. It assesses complexity, independence and whether the mapped profile can satisfy correctness, safety, functionality and required format. Lower depth/polish can be acceptable. Every typed answer must have valid normalized probabilities, the selected maximum, confidence ≥0.95 and selected probability ≥0.95. Unknown, dependent and quality-uncertain answers abstain. These scores are not calibrated probabilities of correctness.

`evaluateJev` preserves validated signals and rejection reasons even when no recommendation is possible. Do not conflate provider abstention with proof of optimality. Provider text, credentials and drafts never enter production traces. Classification token counts accept only bounded nonnegative integers.

The comparison selects among source-configured `PROFILES`. The initial catalog covers three profiles, not the full model/effort search space. Profile tables are injectable into the pure policy and Jev request builder. When changing production mappings, update `PROFILES`, bump `PROFILE_VERSION`, and evaluate calibration followed by held-out cases. Keep the catalog supplied to Jev identical to the policy catalog. New families need explicit capability, family-recognition, cost-ordering and deployment-ID support; never infer a family from an arbitrary custom name. Fable and higher efforts need evidence before becoming default candidates.

Mandatory quality eligibility precedes cost comparison. Stronger advice can recommend a cost increase. Cheaper advice is suppressed for long or unmeasured resumed context because cache reload may dominate. The current comparison uses ordinal model/effort estimates, not a monetary calculation; lower inference cost can be offset by token counts, cache effects and Jev overhead. It makes no percentage-savings claims. Speed alone never produces advice.

Same-model effort advice requires a reliable current effort from the host's live configuration row or an observed outgoing request. Saved defaults are not treated as the current effort. Host changes invalidate pending acceptance, and dispatch verifies the current request again. Unknown effort disables effort-only suggestions.

## Acceptance and host adapter

`Advisor` is an in-memory consent ledger. Its internal text/cache keys are private memory; only its safe `record` and counters may be serialized. IDs increase within a session. Revisions invalidate stale advice and acceptance; returning to old text does not restore old acceptance. Dismissals suppress repeated advice for the identical draft/context key. Cache capacity is 32 assessments and no cache is persisted.

Host transport stays in the hooks module because Claude statically discovers capability calls. A two-second idle timer starts assessment outside the typing hook. Only one physical HTTP request may run, even after the 1.5-second advice timeout. Background starts are at least ten seconds apart. Submission never awaits Jev. Late results are discarded for a submitted or changed draft.

`/route check` is an explicit manual/headless entry point using the same provider and guards. It never authorizes application. The benchmark harness must separately accept the displayed ID; no evaluator-only automatic mode exists.

Accepted profile changes pass through `turn.step` once per request, without saving defaults or replaying started requests. Identity mismatch, failure, unavailable permission state, hidden/queued context and host overrides prevent further application. A model-confirmed accepted profile covers the task's tool loops and follow-ups. Volatile state is deliberately discarded on reload; resumed sessions protect the host profile rather than guessing past acceptance.

A first answer may be necessary for a host to emit authoritative permission state. The current native API has no general pre-draft mode getter. Plan indicators can add protection but cannot grant permission. A submission lifecycle event rechecks permission before application. Keep this limitation explicit in tests and documentation.

## Evaluation contracts

Trace schema 2 separates suggested and accepted records from dispatched and model-confirmed turns. Follow-ups can produce more confirmed turns than acceptance records. Model identity confirmation is separate from effective effort and answer quality.

Run portable, native, Python grader and real-host synthetic checks. The 48-case corpus has 24 calibration and 24 held-out cases across six categories. Labels accept multiple adequate profiles and distinguish useful advice from justified silence. Offline label replay tests the policy, not Jev. Paid `evaluate-advice.py --live` evaluates actual Jev predictions; `--answers` buys paired baseline/candidate answers. Review mandatory quality and depth separately; never report unreviewed free-form answers as passing. Do not tune thresholds against held-out labels or to maximize switch counts.
