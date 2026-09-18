---
description: Catch up a fresh session on the state of the feature-branch backlog and what's next
allowed-tools: Bash(git:*), Bash(gh:*), Read, Glob, Grep
---

# Handoff

You're picking up work from a session that prepared several feature
branches for review (started 2026-09-18, continuing across sessions).
General workflow policy (commit automatically, `/open-pr` to push+open a
PR, no local re-verification, merge is the human checkpoint) already lives
in CLAUDE.md — don't re-derive it here. This command is only about the
_concrete, current state_ of that specific backlog, which changes every
session and needs re-checking, not remembering.

Do the following, in order, then report a concise summary — don't just
dump raw command output.

## 1. Branches

`git branch -vv` (shows tracking status too) and `git status --short` on
the current branch. For every `feature/*` branch: is it ahead of `main`?
Does it track a remote branch (pushed) or not?

## 2. PRs and CI

For each `feature/*` branch that's pushed: `gh pr view <branch> --json
number,state,mergeable,statusCheckRollup,reviewDecision,url` (or `gh pr
list --head <branch>` first if unsure a PR exists). Report per branch:
PR number/URL, CI status (passing/failing/pending — if failing, name the
check), merge state, review state. If a PR exists but this session has no
CI monitoring bound to it yet, bind it (`ccd_pr` tools) rather than
planning to poll manually.

## 3. Stacking dependencies — check, don't assume

Some branches may be based on another feature branch instead of `main`
(check with `git log --oneline main..<branch>` and `git merge-base
<branch> main` vs `git merge-base <branch> <other-branch>` to confirm,
don't trust a stale memory of which). A stacked branch's PR needs its base
branch merged (or rebased onto `main`) first — call this out explicitly if
it applies to anything currently open.

## 4. Task backlog

`Glob` `.claude/tasks/bugs/*.md` and `.claude/tasks/features/*.md`. For
each, read the `Status:` line. Group into:

- **Still `Status: idea`** — not started, no branch exists yet.
- **`Status: implemented..., awaiting review`** — a branch exists; cross-
  reference against step 1's branch list to confirm it's actually still
  there (a merged/deleted branch means the task file is stale and should
  be removed or have its status corrected).

Read `.claude/tasks/priority.md` for the authoritative ordering/notes on
top of this — it's the source of truth for sequencing, not a guess from
branch names.

## 5. Report

A short status table or list, not raw tool output: branch → pushed? → PR?
→ CI state → recommended next action for that branch. Then one
recommended next action overall (which branch to push/open a PR for next,
which PR needs a fix, which idea task to pick up), respecting the
priority/stacking order from steps 3–4. Ask before pushing/opening a PR
only if CLAUDE.md's standing workflow rules don't already cover it
(they do — don't add a confirmation step this command didn't need).
