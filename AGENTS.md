# AGENTS.md

General instructions for Codex agents working in this repository.

## First Rule

Do not make assumptions when something is unclear.

If a requirement, file ownership boundary, command, dependency, API shape, or expected behavior is unclear, stop and ask the user before implementing. Keep the question short and specific.

## Read Before Working

Before making changes, read the smallest set of docs needed for the task:

- `SPRINTS.md` for current task breakdown, file ownership, dependencies, and acceptance checks.
- `ARCHITECTURE.md` for system diagrams, data flow, and API contracts.
- `PRD.md` for product scope and non-goals.
- `GOALS.md` for demo priorities and success criteria.
- `Makefile`, `backend/Makefile`, and `mobile/Makefile` for commands.

Do not duplicate product decisions inside this file. If product context is needed, read the docs above.

## Work Boundaries

Use `SPRINTS.md` as the source of truth for parallel work.

Before editing, identify:

- sprint number
- task ID
- files owned by the task
- files that must not be touched
- acceptance command

Do not edit files owned by another task unless the user approves it.

## Commands

Run commands from the repository root unless a task says otherwise.

```bash
make help
make doctor
make backend-install
make backend-test
make backend-dev
make backend-check
make mobile-install
make mobile-start
make mobile-android
make android-ready
```

Prefer Makefile commands over raw tool commands. Backend Make targets use `uv` internally.

## Implementation Rules

- Keep changes scoped to the assigned task.
- Prefer existing project patterns.
- Keep files focused and small.
- Do not add unused dependencies.
- Do not refactor unrelated code.
- Do not store secrets in mobile code or committed files.
- Keep API contracts aligned between backend and mobile.
- If changing a shared contract, update all affected tests/types/docs in the same task or ask the user first.

## Verification

Before claiming work is done, run the relevant acceptance command from `SPRINTS.md`.

If verification cannot run, say exactly why:

- missing dependency
- network blocked
- Android device unavailable
- backend not implemented yet
- command failed

Do not claim something works unless it was verified.

## When To Ask The User

Ask before proceeding if:

- the task conflicts with `SPRINTS.md`, `ARCHITECTURE.md`, `PRD.md`, or `GOALS.md`
- the implementation requires editing files outside the task boundary
- an endpoint or data contract needs to change
- a dependency install needs network approval
- a device-specific behavior cannot be verified
- you are unsure which tradeoff the user wants

When asking, include your recommended default if there is an obvious one.
