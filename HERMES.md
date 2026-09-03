# AFZ Engineering Website — Hermes Execution Contract

These instructions apply whenever Hermes works in this repository, including work requested from Telegram.

## Execute, verify, then report

- When the user asks to continue, fix, build, test, benchmark, inspect, or otherwise perform work, use the available tools to do the work. Do not substitute a proposed script or a code block for execution.
- Never claim that a repair, build, test, benchmark, deployment, or verification completed unless the corresponding command or tool action actually ran and produced evidence.
- If execution is unavailable or blocked, say `NOT EXECUTED` and state the specific blocker. Do not present planned commands as completed work.
- Distinguish clearly between `PLANNED`, `EXECUTED`, `PASS`, `FAIL`, and `BLOCKED` states.

## Locate and identify the real checkout first

Before changing anything:

1. Resolve the actual repository root with Git (`git rev-parse --show-toplevel`) or locate the checkout explicitly. Never guess a path such as `Projects\\afz_h3_worker`.
2. Record `git rev-parse HEAD` and `git status --short`.
3. Confirm the package manager and lockfile in that checkout.
4. Inspect the exact failing command and error before choosing a repair.

Do not modify an unrelated checkout when more than one copy exists.

## Dependency and build policy

- This repository uses npm and `package-lock.json`. Prefer `npm ci` to materialize the dependency tree exactly from the lockfile.
- Do not run a blind `npm install <package>` because a module is absent from `node_modules`.
- `tailwindcss` and `@tailwindcss/postcss` are already declared as development dependencies in `package.json` and locked in `package-lock.json`. A missing local Tailwind module normally calls for restoring the locked install first, not adding the latest Tailwind release.
- Inspect `package.json`, `package-lock.json`, `postcss.config.mjs`, and the exact build error before changing dependency metadata or PostCSS/Tailwind configuration.
- Keep manifest and lockfile changes minimal and intentional. If either changes, show the diff and explain why it was necessary.

## Next.js rule

This project uses a newer Next.js release with behavior that may differ from older training knowledge. Before writing Next.js-specific code, read the relevant guide under `node_modules/next/dist/docs/` and heed deprecation notices.

## Required validation evidence

For a build repair, report at minimum:

- repository root
- git HEAD
- dirty/clean status
- Node and npm versions
- dependency-install command and exit code
- build command and exit code
- concise relevant stderr/stdout if a command fails

A successful `npm run build` must be observed with exit code 0 before reporting `BUILD PASS`.

Do not use placeholder comments such as “verification logic would go here” and then describe verification as complete.

## Website benchmark guard

- Treat build repair and the 35B website benchmark as separate phases.
- Do not start or repeat the benchmark until the required build/preflight is actually passing.
- Before launching a model call, check the benchmark trace/state for an already-started call so a timeout or transport interruption does not cause a duplicate run.
- Report the model-call result only from actual observed output; do not infer completion from a submitted command.

## Change boundaries

Routine local dependency restoration, build validation, and read-only inspection are allowed when requested as part of this workflow. Do not deploy production, alter network configuration, change Hermes provider/model configuration, restart unrelated services, or modify unrelated projects unless the user explicitly asks for that action.
