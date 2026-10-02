# Contact worker recovery checkpoint, 2026-10-02

Resume key: `AFZ-CONTACT-HOTFIX-20261002`

## Current state

The live public form is connected to the recovered private mail handler. Actual mailbox delivery remains unverified; no real test enquiry has been sent in this recovery.

The public site remains on HP Envy. The sending worker currently runs on H3 and uses the existing protected Microsoft configuration in place. Credentials were not copied, displayed, or committed. A credential-transfer attempt was blocked and not completed; the unused session-generated transfer key was removed. H3 must remain online, and its recovered credential volume must be present whenever the worker starts.

## Verified

- The Microsoft token request succeeded and the existing application has Mail.Send. No permission changes or secret rotation were performed.
- The original sender and fixed business-inbox recipient are preserved. Request bodies cannot override the recipient.
- All 20 mocked regression tests passed. These do not send real messages.
- npm audit reported zero known dependency vulnerabilities at this checkpoint.
- The worker listens only on H3's Tailscale address. Only HP Envy can submit contact requests; an unauthorized peer check returned HTTP 403 even with a spoofed forwarded header.
- The persistent scheduled task is Running, uses S4U with Limited privileges, starts after boot, and is configured to restart after failure. No destructive live restart drill was run.
- GET /contact on both public hostnames follows the existing redirect and returns HTTP 200.
- GET /api/contact now returns HTTP 405, as expected for the POST-only endpoint.
- Empty JSON POST requests on both public hostnames return structured HTTP 400 errors from the recovered worker.
- The production asset guard and Caddy configuration validation passed.
- Public HTML and widget file hashes are unchanged. The redesign and staged front-end replacement remain undeployed.
- Public-edge and Nextcloud container PIDs/start times were unchanged. FamilyPTT health and client-config responses retained their hashes.

## Source and runtime identity

Handler source SHA-256: `c24482cfd8b1f10f8a4e0084aecc7af4d314126627d8e001cd7b97f099399a40`

Live Caddy SHA-256: `fb5caf46ca92536900759ad29ee1384815d6bc284c5b3da8de8556ed7db2c35c`

Mail-route generation/deployment source: `fad942ed5f8040aae14b73854a8a4b8d6b46c573`.

A compare-before-write guard protected the previous live configuration. Only the public-edge container received SIGUSR1. Do not use the ambiguous default Caddy admin socket. Backup and detailed evidence are retained in the private continuation directory.

## Remaining gate

Confirm authorization for one clearly labelled end-to-end test to the actual recovered business-inbox recipient, then verify receipt through the connected Outlook account. The earlier test proposal named the public contact mailbox instead, so no differently addressed test has been sent silently.

Keep PR 11 as draft until this delivery verification is complete. A healthy process, valid token, successful mocked test, or rejection of invalid input does not establish actual delivery.
