# Migrating to 0.6 experimental

- `/route auto` no longer enables anything. It explains explicit acceptance.
- Advice is now pre-send, including eligible unfinished drafts. Review the new TypeSafe data disclosure before supplying a key.
- Use the card buttons or `/route accept <id>` / `/route dismiss <id>`. Headless clients can run `/route check <prompt>`, inspect advice, accept its ID, then submit the exact prompt. A CLI may need its first normal answer before it exposes permission state; finish that task and use `/route new`.
- An accepted model/effort applies only to that task after API identity confirmation. It covers tool loops and follow-ups. Model defaults are never saved. Reloading drops in-memory acceptance and the mod's active profile; a resumed conversation protects its host selection.
- Plan mode, implementation and asides share the same task protection. Only `/route new` clears task continuity; it cannot override plan mode or pins. An “unrelated” prefix no longer clears continuity.
- The optional Haiku classifier and local-rule advice are retired. `/route classifier off` disables assessment. No fallback silently substitutes for Jev.
- Jev question version 3 adds a mandatory-quality adequacy question. All three typed answers retain the 0.95 confidence and probability gates.
- Trace schema 2 reports `recommendation`, `counters.suggested`, `accepted`, `dispatched`, `confirmed`, and separately versioned components. Counters count advice records, accepted records, attempted turns and model-confirmed turns respectively; follow-up turns can outnumber accepted records. Confirmation verifies API identity, not effective effort or quality.

## Rollback

The existing [v0.5.0 release](https://github.com/UtkarshDubeyGIT/claude-model-router-mod/releases/tag/v0.5.0) is preserved. To try it without replacing repository history:

```sh
git clone --branch v0.5.0 --depth 1 https://github.com/UtkarshDubeyGIT/claude-model-router-mod.git model-pilot-0.5
claude --plugin-dir ./model-pilot-0.5
```

Disable the marketplace copy before loading a local copy to avoid duplicate hooks. Version 0.5 is advisory by default, but still contains the old optional automatic mode. Do not enable it when you want 0.6's individual acceptance semantics.
