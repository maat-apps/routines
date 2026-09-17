---
description: Generate a PR description as a plain bullet-point summary — no headers, no test plan, no references to the gitignored .claude/tasks/ folder
allowed-tools: Bash(git:*), Read
---

Look at the current branch's diff against `main` — `git log --oneline main..HEAD`,
`git diff main --stat`, and the actual diffs where needed to understand _why_
a change was made, not just _what_ changed.

Write the PR description as a flat bulleted list summarizing the changes and
their motivation. Rules:

- No markdown headers of any kind — no `##`, no "Summary", no
  "Test plan"/"Test Plan" section.
- Never reference `.claude/tasks/` or any file under it. That folder is
  gitignored and never committed, so a link to it is broken for anyone
  reviewing the PR who doesn't have this exact local checkout.
- Group related changes into one bullet rather than listing every touched
  file — this is a description, not a diff manifest.
- Output the whole description inside a single fenced ```markdown code
  block, and nothing else.
