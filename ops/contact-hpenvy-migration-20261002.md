# Contact service: HP Envy-only migration, 2026-10-02

Resume key: `AFZ-CONTACT-HPENVY-ONLY-20261003-VERIFIED`
Previous key: `AFZ-CONTACT-HOTFIX-20261002`

## Active placement

The owner explicitly requested that the entire website contact service run on HP Envy without H3. The public site was already there. The contact worker, private Microsoft configuration and persistent startup are now on HP Envy as well.

The live public edge now proxies `/api/contact` to `127.0.0.1:8510`. The worker binds only to loopback and trusts only the local edge. Its launcher pins these settings after loading the recovered mail configuration. No public or Tailscale listener was added for the worker.

Service: `afz-contact-handler.service`, enabled in the HP Envy user service manager. Existing user lingering is enabled. Automatic restart after a failure was demonstrated before the public route was changed. The website and contact worker were not reboot-tested.

The private configuration was transferred directly over host-key-verified SSH after the owner's explicit migration request. It is stored outside Git in a private HP Envy directory, with directory mode 0700 and file mode 0600. The service uses systemd LoadCredential. Values were not displayed or committed. No credentials were rotated and no Microsoft permissions were changed. The original sender and fixed recipient are preserved.

## H3 retirement

At 2026-10-02T19:18:26Z, the H3 task `AFZ Website Contact Handler` was verified Disabled, with startup disabled and zero listeners on its old port. The task definition was backed up before disabling it. Other tasks were not changed. The recovered credential file and old runtime remain as inactive rollback material, not an active dependency.

## Verification

- Microsoft authentication from HP Envy returned HTTP 200 with Mail.Send present.
- 26 mocked Node tests passed; these do not send real messages.
- Three route-generation checks passed, including baseline drift rejection and preservation of all unrelated Caddy JSON configuration.
- npm audit reported zero known dependency vulnerabilities at this check.
- New worker failure recovery passed before public cutover: a different process started automatically and health returned 200.
- Caddy validation passed. Targeted Caddy logs confirmed that the new file configuration reloaded successfully.
- After the route change, public contact pages returned 200, GET `/api/contact` returned 405, and empty POSTs on both hostnames returned structured 400 errors. These checks occurred before H3 worker retirement.
- Public website file hashes, public-edge and Nextcloud container identities, and FamilyPTT health/client-config hashes were unchanged. Neither container was restarted.
- An additional combined post-retirement verification command was blocked by the tool before execution. It was not retried or counted as a passed test.
- No real test enquiry was sent. Actual mailbox receipt remains unverified and requires explicit approval for the real configured recipient.

## Source and rollback

Migration implementation: `2c329574956c790e513bf5d53e625ae4c14a8d3f`. Standard npm test command updated in `14290748da19f95f4c65260bf5ae4ce03c6ed176`.

Live Caddy SHA-256: `d10b93835d506c8d2eab16094fa1beb66c5509eb1d90723b6953454f591e2253`.

The previous Caddy file is saved privately as `Caddyfile.pre-hpenvy-only-20261002`. Restoring it would reintroduce the H3 dependency and also requires deliberately re-enabling the retired worker. Do not silently restore that topology. Only the public-edge container was signalled with SIGUSR1; do not use the ambiguous default Caddy admin socket.

Actual delivery is verified. PR 11 can leave draft state; it remains unmerged until an explicit merge step. The redesign and earlier staged frontend changes remain undeployed.
