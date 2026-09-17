---
description: Push the current branch and open a GitHub PR with a generated description, then wire up CI monitoring
allowed-tools: Bash(git:*), Bash(gh:*), Read
---

Do NOT proceed past step 1 or step 2 without stopping and telling the user why.

1. **Preconditions.**
   - `git branch --show-current` — refuse if it's `main`. Tell the user to
     branch first.
   - `git status --short` — refuse if there are uncommitted changes. Tell the
     user to commit or stash first; never commit on their behalf here.

2. **Verify, if not already done this session.** If `npm run validate` (or
   its equivalent steps — format:check, lint, typecheck, test:coverage,
   build) hasn't already passed earlier in this conversation, run it now
   (same as `/check`). Fix failures using CLAUDE.md and
   `.claude/docs/patterns.md` conventions, then continue.

3. **Push the branch.**
   - `git rev-parse --abbrev-ref --symbolic-full-name @{u}` to check if it
     already tracks a remote branch.
   - If untracked: `git push -u origin <branch>`. If tracked: `git push`
     (only if local is ahead of remote — check first, don't force).

4. **Draft the PR title and description.**
   - Title: short (under 70 chars), imperative, no trailing period.
   - Description: follow the exact rules from `/pr-description` — inspect
     `git log --oneline main..HEAD`, `git diff main --stat`, and the actual
     diffs to understand _why_, not just _what_. Output a flat bulleted
     list, no markdown headers, no "Summary"/"Test plan" sections, no
     reference to `.claude/tasks/` (gitignored, invisible to reviewers),
     changes grouped logically rather than one bullet per file.

5. **Show the drafted title + body to the user and wait for explicit
   confirmation before creating anything.** Opening a PR is visible to
   others — running this command is not itself that confirmation for the
   exact content.

6. **Create the PR**, once confirmed, via:

   ```
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   <body>
   EOF
   )"
   ```

   End the body with the attribution lines given in this conversation's
   system-reminder, when one is present.

7. **Wire up CI monitoring.** Use the `ccd_pr` tools (`bind_pr`, then
   `set_monitor`) on the newly created PR so its checks are watched and
   Auto-fix can be offered if something fails — instead of polling `gh` by
   hand. Do not enable auto-merge.

8. Report the PR URL back to the user.
