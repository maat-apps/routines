---
description: Bootstrap or refresh a complete Claude Code workflow (CLAUDE.md, hooks, commands) tailored to this project's real stack and npm scripts
argument-hint: [--dry-run] [--refresh]
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(npm:*), Bash(npx:*), Bash(node:*), Bash(cat:*), Bash(git:*), Bash(ls:*), Bash(find:*)
---

<!--
HOW TO USE THIS FILE
Drop this file at .claude/commands/setup-claude-workflow.md in any new project, then run:
  /setup-claude-workflow           → first-time setup
  /setup-claude-workflow --dry-run → show the plan without writing anything
  /setup-claude-workflow --refresh → re-detect stack/scripts and update generated files,
                                      preserving anything outside the AUTO-GENERATED markers
This command does NOT assume any stack. Every command, hook, and convention it produces is
derived from what it finds in THIS project (package.json, config files, actual source code).
-->

# Setup Claude Code Workflow

You are configuring the Claude Code workflow for the project in `$CLAUDE_PROJECT_DIR`. Follow
the phases below in order. Work from evidence in this repo, not from assumptions about what a
typical project of this kind usually looks like. Where you must choose between two reasonable
options, prefer whichever one is closer to what the existing codebase already does.

Two goals apply to everything you produce in this command:

1. **Code quality is enforced deterministically wherever possible** — formatting, linting,
   type-checking and tests belong in hooks and in the `/check` command, not in prose reminders
   that depend on the model remembering to run them.
2. **Token usage stays lean** — CLAUDE.md stays short and is loaded every session, so only
   high-signal, stable facts belong there. Anything detailed, long, or likely to grow (pattern
   logs, anti-pattern lists) goes into a separate file that's only pulled in on demand.

If `$ARGUMENTS` contains `--dry-run`, do everything through Phase 3, then print the plan for
Phases 4–6 (what would be created/changed) and stop without writing files.
If `$ARGUMENTS` contains `--refresh`, treat existing generated files as ones to update in place
(see the merge rules in each phase) rather than create from scratch.

## Phase 1 — Discover the real project

1. Read `package.json`. Record: `scripts`, `dependencies`, `devDependencies`, `workspaces`
   (monorepo?), `type` (module/commonjs).
2. Confirm npm is the package manager in use (look for `package-lock.json`; flag it if you find
   `yarn.lock` or `pnpm-lock.yaml` instead, and ask before proceeding — the generated hooks and
   commands assume `npm run`).
3. Classify every script in `scripts` into a role using this priority order (a script can only
   fill one role — pick its best match):
   - `dev` / `start` → **dev**
   - `build` → **build**
   - name or body matches `tsc|type-?check` → **typecheck**
   - name or body matches `test` and NOT `watch` → **test**
   - name matches `test:watch|test:dev` → **test:watch**
   - name or body matches `lint` and body contains `--fix` or name contains `fix` → **lint:fix**
   - name or body matches `lint` → **lint**
   - name or body matches `format|prettier` and (`--check` or `-c` present) → **format:check**
   - name or body matches `format|prettier` → **format**
     Record the resolved table (role → script name → full command). This table is the single
     source of truth used in every later phase — never hardcode a script name anywhere else.
4. Detect the framework/stack from `dependencies` (react, next, vue, nuxt, svelte, express,
   nestjs, fastify, etc.) and record a one-line stack summary.
5. Detect tooling by config file presence, not by guessing:
   - Lint: `.eslintrc*`, `eslint.config.*` → ESLint. `biome.json` → Biome.
   - Format: `.prettierrc*`, `prettier.config.*` → Prettier. Biome also formats if present.
   - Types: `tsconfig.json` → TypeScript.
   - Tests: `jest.config.*` or `jest` key in package.json → Jest. `vitest.config.*` → Vitest.
     `playwright.config.*` → Playwright (E2E, treat separately from unit tests — don't wire E2E
     into the per-file hook).
6. For each detected tool, determine whether the matching npm script is **file-scopable**:
   look at the script's command string. If it's just the bare binary (+ flags), e.g.
   `"lint": "eslint"` or `"format": "prettier --write"`, it's scopable — a file path can be
   appended via `npm run <script> -- <file>`. If it already hardcodes a target, e.g.
   `"lint": "eslint ."` or `"lint": "eslint src"`, it is NOT scopable (appending a file would
   just add a redundant, slower target). Record scopable vs not per tool — this decides how
   Phase 5's per-file hook invokes it.

## Phase 2 — Sample the codebase for real conventions

1. `Glob` source files, excluding `node_modules`, `dist`, `build`, `.next`, `coverage`,
   `.turbo`. Pick 8–15 representative files spread across different areas (components/pages,
   utilities/lib, services/API layer, tests) — don't just read the first N files alphabetically.
2. From these files, derive:
   - File naming case (kebab-case, PascalCase, camelCase) — note if it differs by file type
     (e.g. PascalCase for React components, camelCase for hooks/utils).
   - Variable/function naming style, and any consistent prefixes (`use*` hooks, `is*/has*`
     booleans, `handle*` event handlers).
   - Folder structure pattern (feature folders vs. type folders, colocated tests vs. separate
     `__tests__`/`tests` directory).
   - Export style (default vs. named) and import ordering/grouping if consistent.
   - Error-handling style (try/catch vs. Result-style vs. error boundaries).
3. Cross-check against the lint/format config: note anything the codebase does consistently
   that is NOT enforced by ESLint/Prettier/Biome rules — these are the "soft" conventions most
   likely to drift, and are exactly what belongs in CLAUDE.md's Conventions section.

## Phase 3 — Recurring patterns and anti-patterns

Use `Grep`/`Glob` for this pass — do not read full files unless a hit needs surrounding context
to interpret. Look for signals such as:

**Anti-patterns:** `any` typed values, `@ts-ignore`/`@ts-expect-error`, leftover
`console.log`/`debugger`, files over ~400 lines or functions over ~60 lines, near-duplicate
function bodies across files, conditionals nested more than 3 levels, unexplained magic
numbers/strings, `async` calls with no error handling, naming that contradicts what Phase 2
found.

**Good patterns worth preserving:** consistently used custom hooks/utilities, a repository or
service-layer pattern, consistent test structure (e.g. Arrange-Act-Assert), consistent
validation/error-boundary usage — anything that shows up 3+ times and isn't just enforced by a
linter.

Write results to `.claude/docs/patterns.md` (create the directory if needed), with sections
`## Good Patterns`, `## Anti-Patterns`, `## Naming Conventions`. Each entry: one line, with a
`file:line` example. This file is deliberately NOT auto-loaded into every session — only
`/find-antipatterns` and `/learn-patterns` (Phase 6) read and update it, and CLAUDE.md only
carries a short pointer to it plus the handful of items that have proven to recur.

## Phase 4 — Generate CLAUDE.md

**Design note (why this phase works the way it does):** an earlier version of this command
treated the whole block between the markers as one unit `--refresh` would wholesale-replace.
That broke in practice — on a real project (routines), the Conventions/Workflow Rules sections
grew, over many sessions, far past this template's own starting content (accumulated
project-specific rules no detection pass could re-derive). A blind `--refresh` would have
silently destroyed all of it. The fix below is based on what that project ended up doing by
hand, which worked: split the block into a small part that's _safe_ to regenerate (it's pure
fact, re-derived from `package.json`/config files, nothing to lose) and a part that's
_accumulated judgment_ (never auto-rewritten past its first creation — only appended to, and
only by a human or an explicit `/learn-patterns` promotion).

**First-time setup** (`CLAUDE.md` doesn't exist yet): create it with both markers below, filling
the template from Phase 1–3 findings.

**`--refresh` behavior** depends on what's already in the file:

- **Markers present**: rewrite only the content between
  `<!-- BEGIN AUTO-GENERATED: setup-claude-workflow -->` and
  `<!-- END AUTO-GENERATED: setup-claude-workflow -->` — and _only_ the Project Snapshot and
  Commands sections inside it (see below). Never touch Conventions or Workflow Rules, inside the
  markers or not — those are append-only, by design, forever. Leave everything outside the
  markers untouched as before.
- **No markers, but `CLAUDE.md` exists** (a project whose file outgrew the markers and had them
  removed, same as routines did): do not write to `CLAUDE.md` at all. Instead print a report —
  the current Phase 1 script-role table and stack summary vs. what a fresh detection pass finds
  — so the person can reconcile any drift by hand. This is the previously-undefined case; it's
  now defined as "report, don't write."
- **`CLAUDE.md` doesn't exist**: same as first-time setup above; `--refresh` and no-flag behave
  identically here.

Keep the whole auto-generated block under roughly 100–150 lines on first creation — this file is
loaded on every session, so it must stay high-signal.

```markdown
<!-- BEGIN AUTO-GENERATED: setup-claude-workflow -->
<!-- Only Project Snapshot and Commands below are ever rewritten by --refresh. -->

## Project Snapshot

- Stack: {one-line framework/stack summary}
- Package manager: npm
- Notable dependencies: {short list}

## Commands

| Purpose    | npm script                   | Runs automatically via            |
| ---------- | ---------------------------- | --------------------------------- |
| Format     | `npm run {format script}`    | PostToolUse hook, per edited file |
| Lint (fix) | `npm run {lint:fix script}`  | PostToolUse hook, per edited file |
| Typecheck  | `npm run {typecheck script}` | Stop hook, summary only           |
| Test       | `npm run {test script}`      | `/check`                          |
| Build      | `npm run {build script}`     | manual                            |
| Dev        | `npm run {dev script}`       | manual                            |

_(omit rows for roles that don't exist in this project instead of leaving them blank)_

<!-- Everything below is seeded once, then append-only — --refresh never rewrites it. -->

## Conventions

- {naming/structure bullets from Phase 2, 5–10 max}
- If Phase 1 detected Playwright: a Playwright project's reusable test-helper file belongs at
  `e2e/utils.ts`, not `fixtures.ts` — these are plain functions specs call directly, not
  Playwright's own `test.extend()` fixture-injection system, and "fixtures" implies the latter.
- Full pattern log: `.claude/docs/patterns.md` — read by `/find-antipatterns` and
  `/learn-patterns`, not loaded every session.

## Workflow Rules

- Formatting and lint --fix run automatically after every file edit via hooks — don't manually
  re-run them or narrate that you're about to.
- Before calling a task done, run `/check`.
- Prefer `Grep`/`Glob` over reading whole files; read only what a task actually needs.
- For broad codebase audits, use `/find-antipatterns` instead of reading many files inline.
- After a non-trivial session, run `/learn-patterns` to record what recurred.

<!-- END AUTO-GENERATED: setup-claude-workflow -->
```

## Phase 5 — Hooks (`.claude/settings.json` + `.claude/hooks/`)

Create the directory `.claude/hooks/` and write the three scripts below, substituting the
placeholders using the Phase 1 script table and the scopability determination:

- `{{FORMAT_CMD}}`: if format is scopable → `npm run <format-script> --silent --`; else →
  `npx prettier --write` (or `npx biome format --write` if Biome is the detected formatter).
  Skip entirely (leave the block a no-op) if no formatter was detected.
- `{{LINT_FIX_CMD}}`: if lint:fix is scopable → `npm run <lint:fix-script> --silent --`; else →
  `npx eslint --fix` (or `npx biome lint --write` for Biome). Skip if no linter was detected.

**`.claude/hooks/post-edit-format.mjs`** — runs after every `Edit`/`Write`, scoped to the one
file that changed:

```javascript
#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

function readStdinJSON() {
  try {
    return JSON.parse(readFileSync(0, "utf-8"));
  } catch {
    return null;
  }
}

const input = readStdinJSON();
const filePath = input?.tool_input?.file_path;
if (!filePath || !existsSync(filePath)) process.exit(0);

const IGNORE = [
  /node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.next\//,
  /(^|\/)coverage\//,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
];
if (IGNORE.some((re) => re.test(filePath))) process.exit(0);

const ext = path.extname(filePath);
const JS_TS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
const FORMATTABLE = [...JS_TS, ".json", ".css", ".scss", ".md"];

function run(cmd) {
  try {
    execSync(cmd, {
      stdio: "pipe",
      cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    });
    return null;
  } catch (e) {
    return (e.stdout?.toString() || e.message || "")
      .split("\n")
      .slice(0, 3)
      .join("\n");
  }
}

const errors = [];
if (FORMATTABLE.includes(ext)) {
  const out = run(`{{FORMAT_CMD}} "${filePath}"`);
  if (out) errors.push(`format: ${out}`);
}
if (JS_TS.includes(ext)) {
  const out = run(`{{LINT_FIX_CMD}} "${filePath}"`);
  if (out) errors.push(`lint: ${out}`);
}
if (errors.length) console.log(errors.join("\n"));
process.exit(0);
```

**`.claude/hooks/guard-protected-paths.mjs`** — runs _before_ `Edit`/`Write`, blocks direct edits
to generated/lock files so Claude uses the proper npm command instead:

```javascript
#!/usr/bin/env node
import { readFileSync } from "node:fs";

function readStdinJSON() {
  try {
    return JSON.parse(readFileSync(0, "utf-8"));
  } catch {
    return {};
  }
}

const filePath = readStdinJSON()?.tool_input?.file_path || "";
const PROTECTED = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.next\//,
  /(^|\/)node_modules\//,
];
if (PROTECTED.some((re) => re.test(filePath))) {
  console.error(
    `Blocked: "${filePath}" is generated or a lockfile. Use the relevant npm command ` +
      `(npm install, npm run build, ...) instead of editing it directly.`,
  );
  process.exit(2);
}
process.exit(0);
```

**`.claude/hooks/session-typecheck.sh`** — runs on `Stop`, gives a one-line nudge only if type
errors remain (skip creating this file entirely if Phase 1 found no typecheck script):

```bash
#!/usr/bin/env bash
cd "$CLAUDE_PROJECT_DIR" || exit 0
OUT=$(npm run {{typecheck script}} --silent 2>&1)
ERR_COUNT=$(printf '%s' "$OUT" | grep -cE 'error TS')
if [ "$ERR_COUNT" -gt 0 ]; then
  echo "⚠ $ERR_COUNT TypeScript error(s) remain. Run /check for details."
fi
exit 0
```

Make all three scripts executable (`chmod +x`). Then merge (don't overwrite) the following into
`.claude/settings.json` — if the file exists, parse it, append these hook entries to the
matching event arrays (skip an entry if a hook with the same `command` already exists), and
write it back with 2-space indentation. Omit the `PreToolUse`/`PostToolUse` entries if the
matching script wasn't created above.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-protected-paths.mjs\"",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/post-edit-format.mjs\"",
            "timeout": 20
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/session-typecheck.sh\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

## Phase 6 — Supporting commands (`.claude/commands/`)

Create these three files (skip a command if its prerequisite script doesn't exist, e.g. no
`/check` test step if there's no test script — just omit that step from the body):

**`.claude/commands/check.md`**

```markdown
---
description: Run the project's full verification suite (format, lint, typecheck, tests) using its actual npm scripts
allowed-tools: Bash(npm:*), Read
---

Run, in order, only the scripts that exist for this project (see CLAUDE.md's Commands table;
re-resolve from package.json if it seems stale):

1. Format check
2. Lint
3. Typecheck
4. Tests (non-watch mode)

For each step report only: ✅/❌, and for ❌ the first ~10 offending lines with file:line
references — never paste full raw logs. If everything passes, reply with exactly:
"All checks passed."
If something fails, fix it using the conventions in CLAUDE.md and `.claude/docs/patterns.md`,
then re-run only the steps that failed.
```

**`.claude/commands/find-antipatterns.md`**

```markdown
---
description: Scan the codebase for recurring anti-patterns and update the pattern log
allowed-tools: Read, Glob, Grep, Edit, Write
argument-hint: [path-or-glob]
---

Scope: $ARGUMENTS (default: the main source tree, excluding node_modules/dist/build/coverage).
Use Grep/Glob only; read full files only when a hit needs context to interpret. Look for the
categories listed in CLAUDE.md's Conventions section and in `.claude/docs/patterns.md`.

Append new, non-duplicate findings to `.claude/docs/patterns.md` under `## Anti-Patterns`,
grouped by category, one line + file:line each. Reply with only a short summary: counts per
category and the 5 most severe findings — not the full list.
```

**`.claude/commands/learn-patterns.md`**

```markdown
---
description: Review this session's changes and record recurring good/bad patterns for future sessions
allowed-tools: Bash(git:*), Read, Edit
---

Review: !`git diff --stat` and !`git diff`

Note anything from this session that recurred or stood out: good patterns worth repeating,
anti-patterns introduced or fixed, naming/structural conventions confirmed or violated — each
as one line with a file:line example. Append new items to `.claude/docs/patterns.md` (dedupe
against existing entries).

If an item now appears 3+ times across the pattern log, promote a one-line summary of it into
CLAUDE.md's Conventions section (inside the AUTO-GENERATED markers) and delete the now-redundant
detail entries from patterns.md, so the pattern log doesn't grow without bound.

Reply with a 2–4 line summary of what changed in the pattern log, nothing else.
```

## Phase 7 — Report

Print a compact summary: detected stack, the resolved script-role table from Phase 1, which
files were created vs. updated, and a reminder to run `/check` once to confirm everything
resolves correctly. Do not print the full contents of the generated files — the user can open
them directly.
