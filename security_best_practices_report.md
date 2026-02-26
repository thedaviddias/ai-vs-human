# Security Best Practices Report

## Executive Summary
This report evaluates the `ai-vs-human` repository against modern security best practices for its core stack: **Next.js (App Router), React, and Convex (Backend)**. Overall, the project demonstrates a strong security posture, notably in its strict data minimization techniques during GitHub private repository synchronization. However, an immediate, critical authorization bypass vulnerability was identified and resolved during this review. 

## 1. Critical Findings

### ID-1: Missing Server-Side Authorization for Private Stats (RESOLVED)
- **Impact**: Allowed any user to fetch the aggregated private repository commit statistics of another user, even if the victim explicitly disabled the `showPrivateDataPublicly` privacy setting.
- **Location**: `convex/queries/privateStats.ts` (`getUserPrivateDailyStats`, `getUserPrivateWeeklyStats`) and `convex/queries/users.ts` (`getUserByOwnerWithPrivateData`).
- **Description**: The application relied on the client-side UI to hide the "Private Repo Card", but the backend queries used to fetch the data did not enforce authorization checks. Anyone calling these queries directly could retrieve the data.
- **Fix Applied**: A new authorization helper `requirePrivateDataAccess` was implemented and injected into these queries. It strictly verifies that either `showPrivateDataPublicly` is true, or that the requester is the authenticated owner of the data.

## 2. High Findings

### ID-2: CSRF Validation on State-Changing API Routes
- **Impact**: Attackers could trick an authenticated user's browser into making state-changing requests to the Next.js `/api/` routes.
- **Location**: `app/api/analyze/user/route.ts` and `app/api/analyze/resync-user/route.ts`.
- **Description**: While Better Auth handles its own CSRF, custom Next.js API route handlers using `POST` must manually validate origins if they rely on cookie-based authentication. 
- **Mitigation/Recommendation**: Ensure all custom `POST` handlers inside the `app/api/` directory that perform state changes validate the `Origin` or `Referer` header against the expected site URL (or use a dedicated CSRF token). The project utilizes `buildTrustedOrigins`, but verify its enforcement on all custom mutations.

### ID-3: Rate Limiting Enforcement
- **Impact**: Attackers could exhaust system resources or trigger massive GitHub API usage, leading to secondary denial of service.
- **Location**: `convex/mutations/requestPrivateSync.ts`.
- **Description**: Syncing repositories is a heavy background task. 
- **Mitigation/Recommendation**: The database schema defines a `repoResyncRateLimits` table. Ensure this rate limit is strictly checked *before* scheduling the `privateRepoSync` internal action to prevent abuse loops.

## 3. Medium Findings

### ID-4: Image Optimization & External Domains
- **Impact**: SSRF or abuse of Vercel image optimization bandwidth if unconstrained domains are permitted.
- **Location**: `next.config.ts`.
- **Description**: Next.js requires explicit configuration of allowed image hostnames to prevent abuse of the `_next/image` endpoint.
- **Mitigation/Recommendation**: Ensure `next.config.ts` strictly whitelists `avatars.githubusercontent.com` and `github.com` instead of using wildcard domain matching.

### ID-5: Output Encoding & XSS Prevention
- **Impact**: Potential DOM-based XSS if user-supplied data (like repository descriptions) is rendered unsafely.
- **Location**: `components/pages/UserDashboardContent.tsx`.
- **Description**: React natively escapes variables (e.g., `{ghRepo.description}`), which mitigates most XSS. 
- **Mitigation/Recommendation**: Continue to avoid `dangerouslySetInnerHTML`. A grep of the repository confirms zero usages of `dangerouslySetInnerHTML` or `eval()`, which is excellent.

## 4. Secure Baselines Met

The following best practices are successfully implemented and verified:
- **No Hardcoded Secrets**: No sensitive environment variables, GitHub tokens, or database URIs are committed to the repository.
- **Data Minimization**: The `privateRepoSync` worker operates exclusively in-memory, discarding raw commit SHAs and paths, persisting only anonymous, aggregate counts.
- **Modern Framework Features**: The use of Next.js App Router and Convex abstract away many traditional web vulnerabilities (like SQL injection).
- **Secure Token Storage**: GitHub OAuth tokens are handled by the Better Auth adapter and are strictly retrieved server-side by the worker tasks, never exposing them to the React frontend.