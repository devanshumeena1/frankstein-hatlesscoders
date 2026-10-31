# Phoenix Recovery Report

## Overview

This document describes every bug found and fixed across `phoenix-backend`, `phoenix-frontend`, and `phoenix-ci`. Each entry covers: what was wrong (symptom), why it was wrong (root cause), what was changed (fix), and how it was verified.

---

## phoenix-backend

### 1. Wrong environment variable name (MONGO_URL -> MONGODB_URI)
**Symptom:** The server failed to connect to MongoDB on startup.
**Root cause:** `config.ts` validated `MONGO_URL` but all documentation used `MONGODB_URI`.
**Fix:** Renamed the env var key in `config.ts` and `server.ts` to `MONGODB_URI`.
**Verified:** Server starts and connects.

### 2. Deprecated Mongoose 8 connection options
**Symptom:** Mongoose 8 warnings/errors on startup.
**Root cause:** `db.ts` passed `useNewUrlParser`, `useUnifiedTopology` which were removed in Mongoose 8.
**Fix:** Removed all deprecated options from `mongoose.connect()`.
**Verified:** Connection works cleanly.

### 3. express.json() middleware placed after routes
**Symptom:** All POST request bodies were `undefined`.
**Root cause:** `app.ts` registered routes before `express.json()`.
**Fix:** Moved `express.json()` before all route registrations.
**Verified:** Login and all POST endpoints correctly receive request bodies.

### 4. Duplicate User model registration crash
**Symptom:** Runtime crash: "Cannot overwrite User model once compiled".
**Root cause:** `user.ts` and `models/index.ts` both called `mongoose.model("User", ...)`.
**Fix:** Removed duplicate registration from `index.ts`; it now re-exports `User` from `user.ts`.
**Verified:** No model registration errors.

### 5. JWT verification algorithm mismatch
**Symptom:** All authenticated requests returned 401 after login.
**Root cause:** Token was signed with HS256 but `decodeAccessToken` hardcoded HS512 for verification.
**Fix:** Changed `decodeAccessToken` to use `s.JWT_ALGORITHM` consistently.
**Verified:** Login -> protected endpoint round-trip returns 200.

### 6. User.passwordHash field mismatch
**Symptom:** Login always returned 401 even with correct credentials.
**Root cause:** Schema field was `passwordHash` but code sometimes read `password`.
**Fix:** Unified to `passwordHash` everywhere.
**Verified:** Login with alice@phoenix.dev / phoenix123 works.

### 7. Workspace.credits type String instead of Number
**Symptom:** Credit balance displayed as string; arithmetic comparisons failed.
**Root cause:** Schema had `credits: { type: String }`.
**Fix:** Changed to `type: Number`.
**Verified:** Credit balance is numeric.

### 8. Task status enum missing "doing"
**Symptom:** Seed data failed; "doing" filter returned no results.
**Root cause:** `TASK_STATUSES` had `"in_progress"` instead of `"doing"`.
**Fix:** Changed to `["todo", "doing", "done"]`.
**Verified:** Seed inserts all tasks; status filter works.

### 9. Credit check threshold off-by-one
**Symptom:** Tasks created with 0 credits remaining.
**Root cause:** Check allowed creation when `credits === cost`.
**Fix:** Use atomic `findOneAndUpdate` with `credits: { $gte: cost }`.
**Verified:** 402 returned when balance is 0.

### 10. Non-atomic credit deduction (race condition)
**Symptom:** Concurrent requests both deducted the last credit.
**Root cause:** Read-check-write pattern is not atomic.
**Fix:** `Workspace.findOneAndUpdate({ credits: { $gte: cost } }, { $inc: { credits: -cost } })`.
**Verified:** Only one request wins the last credit.

### 11. Idempotency key header name wrong
**Symptom:** Duplicate task creation not prevented.
**Root cause:** Code checked `idempotency_key` (underscore) instead of `idempotency-key` (hyphen).
**Fix:** Changed to `req.headers["idempotency-key"]`.
**Verified:** Same key twice creates only one task.

### 12. Pagination 1-based offset bug
**Symptom:** Page 1 skipped first 10 items.
**Root cause:** `.skip(page * size)` should be `.skip((page - 1) * size)`.
**Fix:** Changed formula to `(page - 1) * page_size`.
**Verified:** Page 1 returns first 10 items out of 25.

### 13. POST /members not enforcing owner/admin role
**Symptom:** Any member could add new members.
**Root cause:** `void actor` discarded the role result without checking it.
**Fix:** Added `if (actor.role !== "owner" && actor.role !== "admin") throw HttpError(403)`.
**Verified:** Bob (member) gets 403; Alice (owner) succeeds.

### 14. /api/health always returned 200
**Symptom:** Health said "ok" even with no database.
**Root cause:** Handler did not check MongoDB connection state.
**Fix:** Check `mongoose.connection.readyState === 1`; return 503 if disconnected.
**Verified:** Returns 503 with disconnected DB.

### 15. Project cache leaks data to non-members
**Symptom:** Removed users could still see cached project lists.
**Root cause:** Cache check happened before `requireMember`.
**Fix:** Moved `requireMember` call before the cache check.
**Verified:** Non-members get 404.

### 16. GET /projects/:id used unsafe type cast
**Symptom:** Invalid project ID caused 500 instead of 404.
**Root cause:** `req.params.projectId as never` bypassed `parseId` validation.
**Fix:** Added `parseId()` call and wrapped in `asyncHandler`.
**Verified:** Invalid ID returns 404.

### 17. Cache invalidation used wrong key
**Symptom:** Stale project list after creating a project.
**Root cause:** `cacheDelete` called with wrong key.
**Fix:** Changed to `cacheDelete(projectListKey(String(id)))`.
**Verified:** Updated list returned immediately after create.

### 18. vercel.json rewrite destination wrong
**Symptom:** All Vercel requests returned 404.
**Root cause:** Destination pointed to a non-existent compiled file path.
**Fix:** Changed to `"/api/index"`.
**Verified:** Vercel routes requests to the serverless handler.

### 19. Serverless handler called app.listen()
**Symptom:** Vercel function timed out trying to bind a port.
**Root cause:** `api/index.ts` called `.listen()` which is invalid in serverless.
**Fix:** Removed `listen()` call; handler passes req/res directly to Express app.
**Verified:** Function returns responses without port binding.

### 20. @vitest/coverage-v8 version mismatch
**Symptom:** `npm ci` failed with ERESOLVE peer dependency conflict.
**Root cause:** `@vitest/coverage-v8@1.6.1` requires vitest@1.6.1 but vitest@2.1.9 was installed.
**Fix:** Updated to `@vitest/coverage-v8@2.1.9`.
**Verified:** `npm install` resolves cleanly.

### 21. tsconfig.json incorrect outDir
**Symptom:** `npm start` could not find compiled files.
**Root cause:** `outDir` was wrong; compiled output went to wrong directory.
**Fix:** Set `"outDir": "./dist"`.
**Verified:** `dist/src/server.js` exists after build.

### 22. package.json had "type": "module"
**Symptom:** Module system conflict between CommonJS and ESM.
**Root cause:** `"type": "module"` forced ESM on TypeScript CommonJS output.
**Fix:** Removed `"type": "module"`.
**Verified:** All imports resolve; server starts.

### 23. Seed script async exit timing
**Symptom:** Partial seed data on some runs.
**Root cause:** `process.exit(0)` called before async operations completed.
**Fix:** Properly awaited `seed()` before calling `process.exit`.
**Verified:** All demo data created atomically.

### 24. Server bound only to 127.0.0.1
**Symptom:** Backend unreachable from Docker/CI networks.
**Root cause:** `.listen(port, "127.0.0.1")` restricts to loopback only.
**Fix:** Removed the host argument; Node binds to 0.0.0.0 by default.
**Verified:** Service reachable from CI.

---

## phoenix-frontend

### 25. localStorage accessed at module load time (SSR crash)
**Symptom:** Next.js SSR crashed: "localStorage is not defined".
**Root cause:** Token read at top level of module, before client-side hydration.
**Fix:** Wrapped in `loadToken()` with `typeof window !== "undefined"` guard.
**Verified:** `npm run build` succeeds; no SSR crashes.

### 26. Token storage key mismatch
**Symptom:** Every request was unauthenticated after login.
**Root cause:** Token stored under one key, read under another.
**Fix:** Unified to `TOKEN_KEY = "phoenix.token"` for both read and write.
**Verified:** Session persists across page refresh.

### 27. Login response field res.token -> res.access_token
**Symptom:** Token was never stored after login.
**Root cause:** `auth.tsx` read `res.token` but backend returns `res.access_token`.
**Fix:** Changed to `setToken(res.access_token)`.
**Verified:** Session persists after login.

### 28. next/router import in App Router page
**Symptom:** Login page crashed with hydration error.
**Root cause:** `useRouter` imported from `next/router` (Pages Router), not `next/navigation` (App Router).
**Fix:** Changed to `import { useRouter } from "next/navigation"`.
**Verified:** Login page renders and redirects correctly.

### 29. react-dom version mismatch
**Symptom:** Peer dependency conflict: React 18 with React DOM 17.
**Root cause:** `package.json` had mismatched versions.
**Fix:** Updated `react-dom` to `18.3.1`.
**Verified:** No peer dep warnings; build succeeds.

### 30. date-fns v3 default export removed
**Symptom:** TypeScript error: "Module has no default export".
**Root cause:** `date-fns` v3 uses named exports only.
**Fix:** Changed to `import { format } from "date-fns"`.
**Verified:** Typecheck passes; dates display correctly.

### 31. next.config.mjs used CommonJS module.exports
**Symptom:** Config failed to load; syntax error.
**Root cause:** `.mjs` extension requires ESM syntax.
**Fix:** Changed to `export default { ... }`.
**Verified:** `npm run build` loads config correctly.

### 32. Deprecated preserveValueImports in tsconfig.json
**Symptom:** TypeScript 5.x deprecation warning/error.
**Root cause:** `preserveValueImports` is deprecated alongside `isolatedModules`.
**Fix:** Removed `preserveValueImports`.
**Verified:** Typecheck passes with no warnings.

### 33. vercel.json had invalid build command and --force install
**Symptom:** Vercel build failed; --force masked dependency errors.
**Root cause:** Invalid script name referenced; --force flag forbidden by rules.
**Fix:** Removed both; Vercel auto-detects Next.js.
**Verified:** Frontend deploys with default Vercel Next.js preset.

### 34. NEXT_PUBLIC_API_URL baked at build time
**Symptom:** Frontend used localhost URL in production.
**Root cause:** `NEXT_PUBLIC_*` vars are inlined at build time; default was localhost.
**Fix:** Documented in `.env.example` that this must be set before build.
**Verified:** Production build uses correct API URL when env var is set.

---

## phoenix-ci

### 35. Pipeline targeted wrong branch (master -> main)
**Symptom:** CI never ran on any pushes.
**Root cause:** `on.push.branches: [master]` but team uses `main`.
**Fix:** Changed to `[main]`.
**Verified:** Pipeline triggers on push to main.

### 36. Node.js 16 instead of 20
**Symptom:** Apps require Node 20; CI ran on EOL Node 16.
**Root cause:** `setup-node` pinned to version 16.
**Fix:** Changed to `node-version: "20"`.
**Verified:** All steps run under Node 20.

### 37. Missing MongoDB service in backend job
**Symptom:** Tests failed: "MONGODB_URI must point at a disposable test DB".
**Root cause:** No database available in the backend job.
**Fix:** Added `mongo:6` service container.
**Verified:** Tests pass with in-job MongoDB.

### 38. e2e job started backend without building
**Symptom:** `npm start` failed: "Cannot find module dist/src/server.js".
**Root cause:** `npm run build` was never called in the e2e job.
**Fix:** Added `npm run build` step before seed and start.
**Verified:** Backend starts successfully in e2e job.

### 39. smoke.sh used wrong health endpoint path
**Symptom:** Smoke test passed even when backend was down.
**Root cause:** Path was `/health`; actual endpoint is `/api/health`.
**Fix:** Changed to `/api/health` with `-f` flag for failure detection.
**Verified:** Smoke exits non-zero when backend is down.

### 40. smoke.sh never exited non-zero on failure
**Symptom:** Failures were silently ignored.
**Root cause:** No error checking; no `set -e`.
**Fix:** Added `set -euo pipefail` and explicit response content checks.
**Verified:** Script exits 1 on any failure.

### 41. wait-for.sh script was missing
**Symptom:** CI crashed: file not found.
**Root cause:** Script referenced in pipeline but never created.
**Fix:** Created `phoenix-ci/scripts/wait-for.sh` that polls until URL answers.
**Verified:** e2e job waits for services before smoke test.

### 42. Actions not pinned to versions
**Symptom:** Non-deterministic, insecure CI.
**Root cause:** Actions used floating `@master`/`@main` tags.
**Fix:** Pinned all to `@v4`.
**Verified:** Pipeline is deterministic.

### 43. Missing least-privilege permissions
**Symptom:** Implicit write access to all repo resources.
**Root cause:** No `permissions:` block.
**Fix:** Added `permissions: contents: read`.
**Verified:** Jobs have minimal permissions.

### 44. Missing job timeouts
**Symptom:** Hung jobs consumed CI minutes indefinitely.
**Root cause:** No `timeout-minutes` set.
**Fix:** Added 15-20 minute timeouts to all jobs.
**Verified:** Jobs fail fast if stalled.

### 45. deploy job ran on PRs too
**Symptom:** Deploys triggered on non-push events.
**Root cause:** Condition only checked `github.ref`, not event type.
**Fix:** Added `&& github.event_name == ''push''` to the `if:` condition.
**Verified:** Deploy only runs on direct pushes to main.
