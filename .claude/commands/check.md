---
description: Run the project's full verification suite (format, lint, typecheck, test coverage, build) using its actual npm scripts
allowed-tools: Bash(npm:*), Read
---

Run, in order (re-resolve from package.json if it seems stale):

1. `npm run format:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test:coverage`
5. `npm run build`

For each step report only: ✅/❌, and for ❌ the first ~10 offending lines with file:line
references — never paste full raw logs. If everything passes, reply with exactly:
"All checks passed."
If something fails, fix it using the conventions in CLAUDE.md and `.claude/docs/patterns.md`,
then re-run only the steps that failed.
