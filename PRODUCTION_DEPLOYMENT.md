# AFZ production website deployment boundary

This repository previously contained only an old Next.js starter and MUST NOT be deployed directly to the AFZ Raspberry Pi production website.

## Current production contract

- Production website target: `/opt/edge/afz-site/html`
- AFZ WebChat backend owner: `hpenvy`
- Browser endpoint: same-origin `POST /api/ai-chat`
- Backend local service: `127.0.0.1:8500`
- NPM must preserve the existing `/api/ai-chat` proxy and trusted `X-AFZ-Client-IP` stamping.
- OneDrive is recovery/import input only during this cutover; it must not become the live deployment transport again.

## Fail-closed rule

`npm run build` runs `scripts/afz-production-deploy-guard.mjs` first. The build is intentionally blocked until `production-site/` contains the reconciled production files and `production-site/manifest.json` is explicitly set to `reconciled: true`.

Required files:

- `production-site/index.html`
- `production-site/contact.html`
- `production-site/services.html`
- `production-site/afz-ai-widget.js`
- `production-site/afz-ai-widget.css`

The guard also verifies the AFZ WebChat contract markers, including chat session persistence, contact project-question prefill, lead-source tracking, and the same-origin `/api/ai-chat` endpoint.

## Recovered production snapshot

The current production source was recovered from the existing AFZ website source on 2026-08-27. Its SHA-256 values are recorded in `production-site/manifest.json` so the Git cutover can prove that the imported files match the known production source before deployment is enabled.

Do not set `reconciled: true` merely to make CI/build green. Only set it after the files are committed and the guard passes.
