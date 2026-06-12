---
name: start-new-feature
description: "Use this skill when the user wants to implement a new feature, bug fix, or any spec-driven change end-to-end through the full development pipeline. Works for any stack (Ktor, NestJS, FastAPI, Laravel, Flutter, Next.js, Lambda, etc.). Invoke immediately whenever the user types /start-new-feature or provides a feature spec/requirement/ticket and wants full implementation. This skill hands the specification off to the orchestrator agent, which runs: (brainstorming gate for vague specs) → architect → worktree isolation → developer → reviewer + security-reviewer (parallel) → qa → housekeeper → human approval → git-agent. Use even for partial specs — the orchestrator handles clarification. Do NOT wait for the user to say 'use the orchestrator' — just use this skill whenever a new feature or bug fix needs to be built."
---

# Start New Feature

This skill launches the `orchestrator` agent to run the full development pipeline for a new feature, bug fix, or spec-driven change — for any project in any language or framework.

## What to do

Immediately invoke the `orchestrator` agent using the Agent tool. Pass the complete requirement specification provided by the user as the prompt, including:

- The full text of the spec, requirement, or description the user provided
- Any additional context from the conversation (target project, constraints, related code)
- The instruction: "Run the full pipeline. Do not skip any stage."

## Prompt template for the orchestrator

```
Run the full development pipeline for the following requirement:

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

## When the spec is vague or incomplete

If the user's requirement is brief or ambiguous (e.g., "add a refresh token endpoint", "improve the upload flow"), still invoke the orchestrator — it will run the brainstorming gate to sharpen the spec before planning. Do not ask the user for more detail before launching.

## After launching

Tell the user: "I've handed this off to the orchestrator. It will detect your project's stack, run through design → architect → worktree → developer → reviewer + security review → QA → docs, then pause for your approval before pushing."
