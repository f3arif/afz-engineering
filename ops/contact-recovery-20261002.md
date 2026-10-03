# AFZ contact outage recovery, 2026-10-02

Resume key: `AFZ-CONTACT-HOTFIX-20261002`.

## Scope

The user approved the contact-only live repair and one clearly labelled test enquiry to design@afzeng.ca. The broader website redesign is excluded.

## Verified live mitigation

The candidate produced by `scripts/afz-contact-edge-hotfix.py` was deployed to the HP Envy public edge from commit `33713dff7060c9631ffdf34caf7dc5bd811cf8af`.

- `/contact` and `/contact/` return 308 to `/contact.html`.
- Existing query strings are preserved. The www host also resolves successfully.
- `/services` redirects to `/services.html`.
- `/api/contact` now returns an explicit JSON 503 stating the message was not sent and providing the business email and phone. This is NOT restored email delivery.
- Contact HTML remains byte-for-byte unchanged. No redesign was deployed.
- Caddy syntax and provisioning validation passed before deployment.
- The live public-edge runtime matches the reviewed candidate. Protected host behavior was compared after normalizing Caddy-generated group labels.
- A targeted SIGUSR1 reload was verified. Public-edge and Nextcloud container PIDs and start timestamps are unchanged. No container was restarted.
- FamilyPTT client configuration and health responses remained HTTP 200 with identical content hashes.

## Delivery blocker

The original sender is a Node/Express Microsoft Graph OAuth client-credentials handler. Its source was recovered from the website backup. The original deployment references a private `form-handler.env` file outside the currently permitted Desktop Commander folders. The recovered Windows Main location cannot be inspected until the user authorizes the narrow folder access or moves the existing credential file into an allowed private directory.

No credentials were displayed, replaced, guessed, or committed. No real test enquiry was sent. The backend must not report success or queue-and-forget enquiries while sender authentication is unavailable.

## Next steps

1. Obtain narrowly authorized access to the existing contact sender credential file. Keep it outside Git and public web roots.
2. Restore the contact service on HP Envy, bound to a private loopback port, preserving input validation, rate limiting, honeypot handling, and AFZ AI lead-source attribution.
3. Test token acquisition without sending. Replace only the temporary contact 503 handler with the verified service route.
4. Send the one approved clearly labelled test enquiry through the public website and verify actual mailbox receipt. Do not equate provider acceptance with delivered mail.
5. Apply the separately staged chat-link/cache and canonical changes, rerun source and browser checks, and record the completed release.

## Deployment safety

There are two Caddy instances sharing the default admin address. Never run an unqualified admin-port reload. The public-edge process was deterministically targeted with SIGUSR1 and then verified against the exact candidate. The Caddyfile is a single-file bind mount: preserve its inode when writing, or explicitly verify what the container sees. Preserve the pre-repair backup and verify the runtime after any change.

Candidate Caddyfile SHA-256: `ddb92e8c7c8755f229438861d2b85c0761b45571b55c558d49af08f12c150828`.
Original Caddyfile SHA-256: `235c2c959e5a5f3475554000f2eae3fe4d28f9d298495c1baa4d03c211df1875`.
