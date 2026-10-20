# Weather Tracker — Mac Studio oMLX/Qwen pilot runbook (2026-10-20)

## Scope and hard constraints

- Run the **Codex orchestrator and existing oMLX/Qwen on the Mac Studio** first. Do not migrate model files or launch an old llama.cpp server. Old MacBook/Tailscale arrangement is contingency only.
- **Android emulator only** for all interactive/app/visual tests. Never touch a physical device, even when `adb devices` lists one.
- Never discard, reset, force-update, stash/pop, or overwrite user changes. Use a disposable Git worktree and branch. Do not merge to `main` as part of the pilot.
- The local Qwen worker is an implementation agent with an explicit allowlist; Codex owns specifications, sandbox orchestration, validation and final semantic review.
- No secret/environment file contents in logs or model prompts. Preserve existing lockfiles/dependencies unless an explicitly approved upgrade task requires changes.

## Phase A — read-only preflight

1. Identify real Weather Tracker repository path and inspect `git status --short`, local/remote refs, current branch and commit; report divergence from GitHub `main` without overwriting anything.
2. Confirm Codex is running on Mac Studio. Discover current local worker configuration and oMLX OpenAI-compatible endpoint *from existing local settings*, not guessed ports; do a bounded `/v1/models` test and a minimal completion/smoke that proves which model was used.
3. Confirm the actual context limit (initial planned 32,768 tokens), model ID, thinking-mode knobs supported by that build, request timeout, maximum output tokens, and worker MCP/tool protocol. Do not assume that legacy llama.cpp flags work with oMLX.
4. Capture before-test memory evidence: `memory_pressure`, `vm_stat`, `sysctl vm.swapusage` and current oMLX process/model memory where available. Never show credentials.
5. Check installed Android SDK, `emulator -list-avds`, `adb devices -l`; explicitly select **an emulator serial only**. If an AVD is absent, create an appropriate Android virtual device if local tooling allows; otherwise report emulator gate as BLOCKED. Never substitute a Samsung handset/tablet.
6. Check that the Weather Tracker FastAPI `8000` development port does not conflict with oMLX; choose an alternate backend port if necessary and set `EXPO_PUBLIC_API_BASE_URL` locally without committing local .env files.
7. Baseline validation: backend `ruff check app tests` and `python -m pytest`; mobile `npm ci` where necessary and `npm run check`. Separate environment/install errors from repository test failures; make no automatic dependency upgrade. Report exact pass/fail counts.

## Phase B — Qwen first implementation task (offline-cache status)

**Observed code issue:** `mobile/src/hooks/useWeatherOverview.ts` can show cached weather after a failed request, but `mobile/App.tsx` renders `Backend: Bağlı` whenever `overviewStatus === 'ready'`. An offline cached snapshot may thus be shown as if backend is connected.

**Goal:** Clearly distinguish fresh network data from cached/stale data while preserving the last valid forecast. Never falsely claim a live backend connection. Prefer a small, accessible Turkish status indication that includes the cache timestamp where appropriate.

**Allowed edits:**
- `mobile/App.tsx`
- `mobile/src/hooks/useWeatherOverview.ts`
- Targeted Jest test files directly exercising those two modules; enumerate exact paths in the per-task specification after inspecting the repo.

**Read-only context:** `mobile/src/storage/weatherCache.ts`, `mobile/src/api/weather.ts`, `mobile/src/types/weather.ts`, existing components and tests as relevant.

**Forbidden:** backend edits, unrelated UI redesign, dependency/lockfile changes, `AGENTS.md`, CI workflows, secrets, device installations.

**Acceptance:**
1. Successful network fetch renders connected/current state.
2. Cache restored while a network request is still loading must not claim backend connected.
3. Network request failing while valid cached data is shown leaves data visible and visibly identifies offline/cached state.
4. User-initiated refresh failure with prior valid data preserves the data and shows non-connected/error or last-updated state.
5. Aborted/outdated requests cannot change the selected city's state.
6. Existing persistence/favorite/hydration behavior is unchanged; TypeScript and targeted Jest tests pass.
7. The change stays inside the file allowlist; no dependency changes; `git diff --check` passes.

**Implementation loop:** Codex writes a precise specification; local Qwen edits *only* the disposable worktree. Local validator runs typecheck plus targeted Jest; feed back only minimal relevant test failures. Limit to 3 substantive repairs, no blind retries. Codex reviews final diff before integration.

**Optional A/B:** If supported and resources allow, execute the same bounded specification from identical clean disposable checkpoints once with non-thinking and once with medium-thinking (or available equivalent). Keep all other sampling/context limits equal and compare final acceptance, total calls, token use, wall time, repair iterations and scope compliance. Do not spend excessive time on A/B if a single reliable run already surfaces a critical blocker.

## Phase C — emulator acceptance

- Start a selected AVD and confirm the exact `emulator-...` serial. Use serial-scoped `adb -s emulator-... ...` only.
- Boot the backend and mobile using their documented local commands, with nonconflicting ports; verify current forecast, switching city, refresh, favorite and offline cached status on the emulator. Capture emulator screenshots/logs as evidence.
- Distinguish successful startup from interactive smoke and from visual acceptance. A failed/unavailable emulator gate means the task is not visually accepted.

## Phase D — report (no silent merge)

Report: repo branch/HEAD, working-tree safety, oMLX server/model/context, Codex and Qwen on-device topology, memory pressure/swap before and during, baseline test counts, first Qwen calls/repairs/context/timing, changed files and diff stats, targeted/full tests, emulator AVD/serial and observed behavior, unresolved risks, and whether MacBook fallback is actually necessary. Stop before merging or device deployment.
