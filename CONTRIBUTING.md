# Contributing

Model Pilot prioritizes task quality, user control and continuity ahead of price. Help improve it with representative evaluations, provider adapters, deployment support, documentation or focused fixes.

## Development

Clone the repository and work on a branch. The mod has no runtime dependencies or build step. Node 20+ runs the portable tests; Python 3 runs the evaluation tests. Claude Code 2.1.303 is the tested host version.

```sh
git clone https://github.com/UtkarshDubeyGIT/claude-model-router-mod.git
cd claude-model-router-mod
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
claude plugin validate --strict .
claude plugin test .
python3 scripts/live-eval.py --offline
```

These checks do not require paid inference. To load your checkout in an interactive session, run `claude --plugin-dir .` from this directory. Avoid simultaneously loading a marketplace copy of the same mod.

## Changes we can review

- Reproduce a behavior defect with a failing test at the affected boundary before fixing it.
- Keep provider parsing, eligibility, profiles, policy and host application separate. See [extension boundaries](docs/extending.md).
- Preserve planning, manual pin, follow-up, attachment and unknown-context protections. Do not silently fall back from Jev to a different classifier.
- Keep provider waits bounded. Never retry an already-issued streaming model request.
- Report recommendations, dispatch attempts and observed models separately. Record requested effort without claiming the provider's internal effort is verified.
- Document any new external data flow, environment setting or host-version requirement.

For a pull request, explain the problem, the final behavior and the checks you ran. Include limitations, especially if live provider or enterprise testing was unavailable. Small, focused changes are easier to review.

## Evaluation and bug reports

Include the plugin and Claude Code versions, provider, starting model/effort, permission mode, session state, expected behavior and observed behavior. A redacted `/route trace` is useful. Provide a minimal synthetic prompt when possible; omit keys, customer data, local paths and private transcript identifiers.

Evaluate answer correctness independently from output formatting and model application. A correct answer with explanatory prose around JSON is a format failure, not necessarily a reasoning failure. A provider timeout is not evidence that its recommended tier was wrong. Compare repeated tasks with explicit rubrics and include failures and abstentions in reported totals.

Paid live suites are opt-in. Set a budget, understand its soft-stop limits, and obtain authorization before using someone else's credentials or sending enterprise prompts to a provider. Do not commit raw live transcripts or credentials. Summaries should distinguish measured Claude cost from unknown TypeSafe overhead, and short benchmarks from enterprise workload evidence.

## Releases

Maintainers update the plugin, marketplace and package versions together, run the checks above, review the public-file list for secrets or private data, and add a changelog entry before tagging a release. Verify installation from the public marketplace after publishing. A GitHub marketplace release is separate from acceptance into Anthropic's official plugin directory.

Contributions are provided under the repository's [MIT license](LICENSE). For sensitive vulnerabilities, follow [SECURITY.md](SECURITY.md).
