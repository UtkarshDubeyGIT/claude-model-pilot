# Model Pilot 0.6 implementation contract

Quality and cost are the goal; speed is only a secondary benefit. No known sacrifice of correctness, safety, functionality or required format is acceptable. Less depth or polish must be disclosed.

Advice appears before sending, after two seconds of inactivity, with explicit acceptance or dismissal. One physical provider request can be in flight; background calls start at least ten seconds apart. Identical draft/context evidence is cached in memory. Sending never waits for advice. Acceptance is bound to the displayed ID, draft and task revision, with protection rechecked at submission and dispatch.

Planning, related implementation, follow-ups and asides share a protected task. Leaving plan mode is not a task boundary. `/route new` cannot override planning or a pin. Unknown mode, attachments, queues, stale acceptance and host model/effort changes prevent application. Never replay a started request.

Assessment, protection, comparison and presentation are separately versioned. Keep the 0.95 gates and the initial three profiles until calibration supports changes. Same-model effort advice needs reliable current-effort evidence. Provider abstention must remain distinguishable from a fit decision.

Evaluate useful advice, justified silence and task-quality preservation. The 48 labeled scenarios are split into 24 calibration and 24 held-out cases. Score semantic correctness, functionality, format, depth/polish, cost and latency separately. Offline tests validate mechanics; live paid calibration remains explicit.

Release 0.6.0 as experimental with the existing identity, unfinished-draft disclosure, updated setup prompt and sanitized evidence. Preserve v0.5.0 for rollback. See [extension boundaries](extending.md), [validation](validation.md) and [migration](migration-0.6.md).
