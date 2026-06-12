---
name: raise-coverage
description: "Run the project's coverage suite, compare actual coverage against the enforced floor, and ratchet the floor upward when the suite clears it with headroom. Use when the user types /raise-coverage, asks to 'raise the coverage threshold', 'ratchet coverage', or after a feature lands that added significant tests. Implements the platform ramp policy: floors only ever go up, never down, and never past the stack's target."
---

# Raise Coverage Floor

This skill operationalizes the coverage **ramp policy** documented in `.claude/rules/testing.md`: every repo enforces an achievable floor that ratchets toward a long-term target as the suite grows.

## Policy (non-negotiable)

- **Never lower a floor.** If actual coverage is below the current floor, report it — fixing that means adding tests, not editing thresholds.
- **Never raise past the target**: NestJS / Next.js → 80, Python / Flutter → 70, blockchain → 90, Kotlin already at target (90–98) — leave Kotlin alone.
- Raise only with **headroom**: actual must clear the current floor by ≥5 points. Set the new floor ~2 points below actual (rounded down), capped at the target.

## Steps

1. **Read `.claude/rules/testing.md`** — it names the coverage command, the current floors, the target, and where the floor lives. Also read `rules/project-context.md` for quirks (e.g. krillin's suite is under repair — if the gate is marked blocked, stop and report).
2. **Run the coverage command** for this stack and capture actual coverage:
   - NestJS: `npm run test:cov` → jest summary table (branches/functions/lines/statements)
   - Python: `pytest` → `Total coverage: X%` line
   - Laravel: `composer run test:coverage` → Pest summary
   - Flutter: `flutter test --coverage && ./scripts/check_coverage.sh <current floor>` → script prints actual %
   - Next.js (jest): `pnpm --filter <app> test:coverage`; (vitest): `npm run test:coverage`
   - Hardhat: `npm run coverage` → istanbul summary
3. **Locate the floor** (source of truth is the build config, not the rules file):
   - NestJS / goku apps: `coverageThreshold.global` in `package.json` `jest` block or `jest.config.ts`
   - Python: `--cov-fail-under=N` inside `[tool.pytest.ini_options] addopts` in `pyproject.toml`
   - Laravel: `--min=N` in the `test:coverage` composer script
   - broly: the number in the Makefile `test-coverage` target (`./scripts/check_coverage.sh N`)
   - Hardhat: the argument in the `coverage:check` script (`node scripts/check-coverage.js N`)
   - aws-dashboard: `coverage.thresholds` in `vitest.config.ts`
4. **Compute new floors** per metric using the policy above. If no metric has ≥5 points of headroom, report "no ratchet available" and stop — do not make no-op edits.
5. **Apply the edit** to the build config, then **re-run the coverage command** to prove the gate still passes at the new floor.
6. **Update the floor table** in `.claude/rules/testing.md` if it lists this repo's current floor.
7. **Report**: old → new floor per metric, actual coverage, and remaining distance to target.

## Example output

```
raise-coverage: bordock
  actual: 27.0% lines
  floor:  20 → 25  (target 70, remaining gap 45)
  gate re-run: PASS
```
