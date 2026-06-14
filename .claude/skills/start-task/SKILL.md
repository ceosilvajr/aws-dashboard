---
name: start-task
description: "Use this skill when the user wants to implement a task end-to-end through the full development pipeline — either a FEATURE or a BUG-FIX. Works for any stack (Ktor, NestJS, FastAPI, Laravel, Flutter, Next.js, Lambda, etc.). Invoke immediately whenever the user types /start-task (optionally with 'feature' or 'bug-fix'), provides a spec/requirement/ticket, or reports a bug they want fixed. Both modes hand the task to the orchestrator agent, which runs: (brainstorming gate for vague specs) → architect → worktree isolation → developer → reviewer + security-reviewer (parallel) → qa → housekeeper → human approval → git-agent. Use even for partial specs — the orchestrator handles clarification. Do NOT wait for the user to say 'use the orchestrator' — just use this skill whenever a feature needs building or a bug needs fixing."
---

# Start Task

This skill launches the `orchestrator` agent to run the full development pipeline for a task in either of two modes — for any project in any language or framework.

**Usage:** `/start-task [feature|bug-fix] <description or spec>`

## Determine the mode first

1. If the user passed `feature` or `bug-fix` explicitly, use it.
2. Otherwise infer: defect language ("broken", "fails", "wrong result", "500 error", "regression", a stack trace) → **bug-fix**; new-capability language ("add", "build", "support", "endpoint for") → **feature**.
3. Only if genuinely ambiguous, ask one question: "Is this a new feature or a bug fix?" — then launch.

Both modes hand over to the **orchestrator** agent for execution. The mode only tailors the handoff instructions; the pipeline stages and gates are identical.

## What to do

Immediately invoke the `orchestrator` agent using the Agent tool. Pass the complete task as the prompt, including:

- The task type: FEATURE or BUG-FIX
- The full text of the spec, requirement, bug report, or description the user provided
- Any additional context from the conversation (target project, constraints, related code, stack traces, reproduction steps)
- The instruction: "Run the full pipeline. Do not skip any stage."

## Prompt template — FEATURE

```
Run the full development pipeline for the following FEATURE:

---
[PASTE THE USER'S FULL REQUIREMENT SPECIFICATION HERE]
---

Additional context:
[Any relevant details from the conversation: target project, known constraints, related files, etc.]

Instructions:
- Detect the project stack from manifest files (do not assume a specific framework)
- If the requirement is vague, run the brainstorming gate first and wait for user approval of the spec
- Execute all pipeline stages in order: architect → worktree isolation → developer → reviewer + security-reviewer (parallel) → qa → housekeeper → git-agent
- Do not skip any stage
- Use a git worktree for all implementation work
- Pause and request human approval before committing and pushing
```

## Prompt template — BUG-FIX

```
Run the full development pipeline for the following BUG-FIX:

---
[PASTE THE USER'S FULL BUG REPORT HERE — symptoms, expected vs actual, stack traces, reproduction steps if known]
---

Additional context:
[Any relevant details from the conversation: target project, affected version/branch, related files, when it started, etc.]

Instructions:
- Detect the project stack from manifest files (do not assume a specific framework)
- This is a BUG-FIX: have the developer follow superpowers:systematic-debugging — reproduce the bug with a FAILING TEST first, find the root cause, then fix. Never patch symptoms without a root cause.
- The failing reproduction test stays in the suite as the regression test — it must pass after the fix
- Keep the fix minimal and root-cause-targeted; no opportunistic refactoring beyond the fix
- Skip the brainstorming gate unless the bug report is too vague to reproduce — if reproduction is unclear, gather the missing details first
- Execute all pipeline stages in order: architect (a short fix plan is fine) → worktree isolation → developer → reviewer + security-reviewer (parallel) → qa → housekeeper → git-agent
- Do not skip any stage
- Use a git worktree for all implementation work
- Pause and request human approval before committing and pushing
```

## When the task is vague or incomplete

- **Feature**: still invoke the orchestrator — it runs the brainstorming gate to sharpen the spec before planning. Do not interrogate the user before launching.
- **Bug-fix**: if there is no way to reproduce from what was given (no symptoms, no steps, no trace), ask for the minimum reproduction details once, then launch.

## After launching

Tell the user: "I've handed this [feature/bug-fix] off to the orchestrator. It will detect your project's stack, run through [design → ]architect → worktree → developer → reviewer + security review → QA → docs, then pause for your approval before pushing."
