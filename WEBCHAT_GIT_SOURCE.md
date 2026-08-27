# AFZ WebChat Git source

The AFZ website chat browser assets are preserved in Git as a byte-for-byte production snapshot while the rest of the legacy static website is reconciled separately.

## Source of truth

Run:

```bash
npm run webchat:verify
```

This reconstructs:

- `webchat-dist/afz-ai-widget.js`
- `webchat-dist/afz-ai-widget.css`

from the versioned bundles under `webchat-source/`, verifies their production SHA-256 values, checks required AFZ WebChat markers, and fails closed on any mismatch.

GitHub Actions also reconstructs and syntax-checks the widget on every pull request and push to `main`.

## Runtime boundary

The browser contract remains:

`afzeng.ca -> same-origin POST /api/ai-chat -> Raspberry Pi NPM -> HP Envy AFZ AI backend`

The HP Envy backend remains independent of website deployment:

- owner: `hpenvy`
- FastAPI: `127.0.0.1:8500`
- health endpoint: `/health`
- chat endpoint: `/api/ai-chat`

Do not put HP/OpenAI secrets in this repository. NPM must keep the established trusted `X-AFZ-Client-IP` behavior for rate limiting.

## Deployment rule

Until the complete static website has been reconciled in Git, do not deploy the repository root or the old Next.js starter to production.

A WebChat-only deployment may copy only the verified files from `webchat-dist/` to the existing production directory `/opt/edge/afz-site/html` without deleting or replacing unrelated website files. After any such deployment, run the existing AFZ `webchat-status` contract and require all of these to pass:

- widget JavaScript syntax
- Pi website/contact backend health
- public chat persistence marker
- public project-question prefill
- public lead-source tracking

The full-site production guard remains intentionally fail-closed until the production HTML/site tree is reconciled and explicitly approved by its manifest.
