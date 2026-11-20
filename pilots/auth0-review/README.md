# AFZ Engineering — Auth0 review pilot

Isolated Express service inside the canonical `f3arif/afz-engineering` repository. This is an authentication and project-access pilot, with two synthetic read-only projects. It is separate from the existing Next.js marketing site and the ChatGPT-hosted HVAC Review Workspace. It does not migrate either application or connect real drawings, uploads, comments, equipment selections or approvals.

## Run and verify

Node 22.12+ is required. From this directory:

```sh
npm ci --ignore-scripts
npm test
npm start
```

The backend binds **only to `127.0.0.1:19870`**. Without private Auth0 settings, `/` explains that connection is pending; protected routes, `/login`, `/callback` and `/healthz` return 503. There is no demo login or runtime test-user switch.

For an owner-approved private HTTPS pilot on the ZBook, add only a dedicated unused Tailscale Serve port:

```sh
tailscale serve --bg --https=19871 --yes http://127.0.0.1:19870
```

Do not use Funnel or change an existing handler. Use the exact HTTPS origin reported by Tailscale as `PILOT_BASE_URL`.

Current staging result (2026-11-20 UTC): the dedicated transient user service is running on loopback. The AFZ Bridge execution identity received a Tailscale authorization error when adding port 19871, so no private HTTPS listener was created. A ZBook administrator must perform that one route addition, or use an SSH forward (`ssh -N -L 19870:127.0.0.1:19870 coolyo@afz-zbook`) and visit `http://localhost:19870/` for a local test. The transient service does not start automatically after reboot. Do not change Tailscale permissions or use another privileged identity to bypass the denial.

## Connect an Auth0 development application

1. In the owner's Auth0 tenant, create a **Regular Web Application**, named **AFZ Engineering Review Pilot**. Use authorization-code login and the SDK's default RS256 validation. The pilot requests only `openid profile email` and uses PKCE. No third-party service scopes or refresh tokens are requested.
2. Add `<PILOT_BASE_URL>/callback` to **Allowed Callback URLs** and `<PILOT_BASE_URL>/` to **Allowed Logout URLs**. Use exact URLs, with no wildcard callbacks. For a local SSH-forwarded test, `http://localhost:19870/callback` and `http://localhost:19870/` may be used instead.
3. On the ZBook, run `npm run configure` in this directory. Enter the tenant origin, exact pilot origin, client ID and client secret interactively. The secret input is hidden, a session encryption secret is generated locally, and values are stored outside Git at `~/.config/afz-engineering-auth0/settings.json` with mode 0600. Existing settings are never overwritten. Do not paste secrets into chat, issues, handoffs or command arguments.
4. Add assignments to the owner-only `~/.config/afz-engineering-auth0/memberships.json`, keyed by each Auth0 user's **full `sub`**, not email. Keep mode 0600. Example with placeholder subjects:

```json
{
  "auth0|REPLACE_CLIENT_SUBJECT": { "role": "client", "projects": ["sample-a"] },
  "auth0|REPLACE_REVIEWER_SUBJECT": { "role": "reviewer", "projects": ["sample-b"] },
  "auth0|REPLACE_ADMIN_SUBJECT": { "role": "admin", "projects": ["sample-a", "sample-b"] }
}
```

5. Restart only this pilot. Sign in with two real tenant accounts and verify both the project list and direct URLs. A newly authenticated account receives no access until assigned. Administrators also need explicit project assignments. Assignment changes take effect on the next request, including existing sessions.

Optional environment overrides: `PILOT_CONFIG_FILE`, `PILOT_MEMBERSHIPS_FILE`, `PILOT_PORT`, `PILOT_BASE_URL`, `AUTH0_ISSUER_BASE_URL`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SESSION_SECRET`. The last two are secrets; prefer the private configuration helper. An issuer must be HTTPS; application HTTP is accepted only for a loopback origin. A readable or malformed configuration/access file fails closed.

## Access behavior

| Condition | Result |
| --- | --- |
| Auth0 settings absent or invalid | Protected routes return 503 |
| Anonymous API request | 401 |
| Authenticated account without assignment | 403 |
| Request for another account's project | 404; no project details |
| Membership revoked in an existing session | Access removed on the next request |
| Missing, malformed or broadly readable membership file | 503 |
| Logout | Local session cleared; fixed return destination |

Roles identify the assignment; all project operations in this pilot are read-only. Roles do not imply permission to approve, issue, upload or edit anything. They are not a completed production role model.

Sessions use encrypted HttpOnly cookies, SameSite=Lax, Secure on HTTPS, a one-hour rolling idle limit and an eight-hour absolute limit. Login and logout destinations are fixed. Project pages and APIs send `Cache-Control: no-store`. OAuth errors do not reflect tokens, callback parameters or configuration. The loopback backend trusts only a local reverse proxy. Real identity-provider audit logs, MFA policy and tenant logout behavior still need tenant verification.

## Verification boundary

`npm test` exercises the actual pinned Auth0 Express SDK against a temporary local OIDC fixture, using RS256 signatures, discovery, JWKS, authorization codes, PKCE, nonce/state and cookie sessions. It tests two users with different project assignments, unassigned users, explicit admin assignments, direct-URL access, immediate revocation, invalid access files, forged cookies, bad signatures, bad nonce, invalid callbacks and logout.

The fixture exists only under `test/`; the running application never imports it. **Passing fixture tests does not verify a real Auth0 tenant.** `/healthz` deliberately does not claim real-tenant verification. Complete a real browser run with two tenant accounts before considering integration with the HVAC workspace.

## Rollback and resource scope

Stop only `afz-engineering-auth0-pilot.service` if that dedicated pilot unit was started. Remove only its dedicated Tailscale Serve listener with `tailscale serve --https=19871 off` after confirming that port still belongs to this pilot. Retain private settings locally unless the owner requests their removal. This branch can be closed without changing the public website, the hosted HVAC Site, source drawings or any existing AFZ service.

Source: `pilots/auth0-review/`. ZBook checkout: `/home/coolyo/AFZ/Engineering/afz-engineering/`. Work claim: [afz-engineering#15](https://github.com/f3arif/afz-engineering/issues/15).

Official references: [Auth0 Express SDK](https://github.com/auth0/express-openid-connect), [Express quickstart](https://auth0.com/docs/quickstart/webapp/express/index), [Auth0 agent integration guidance](https://github.com/auth0/agent-skills/tree/main/plugins/auth0/skills/auth0/references/framework-express).
