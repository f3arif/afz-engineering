#!/usr/bin/env python3
"""Prepare the narrow 2026-10-02 AFZ edge mitigation; never deploy or reload.

This fixes contact-page routing, NOT Microsoft 365 delivery. The missing sender
credentials must be restored and an approved real enquiry verified before the
503 handler below can be replaced by a contact-service reverse proxy.
"""
import argparse
import hashlib
import json
from pathlib import Path

BASELINE_SHA256 = '235c2c959e5a5f3475554000f2eae3fe4d28f9d298495c1baa4d03c211df1875'
ANCHOR = '    @ai path /api/ai-chat\n'
ERROR = ('Online enquiries are temporarily unavailable. Your message has not been sent. '
         'Please email design@afzeng.ca or call 647-812-4119.')
BLOCK = '''    # AFZ-CONTACT-HOTFIX-20261002: preserve legacy links and report delivery honestly.
    map {query} {afz_contact_query_suffix} {
        "" ""
        default "?{query}"
    }
    @afz_legacy_contact path /contact /contact/
    redir @afz_legacy_contact /contact.html{afz_contact_query_suffix} 308
    @afz_legacy_services path /services /services/
    redir @afz_legacy_services /services.html{afz_contact_query_suffix} 308

    # Temporary fail-closed response, not a working mail backend.
    @afz_contact_unavailable path /api/contact
    handle @afz_contact_unavailable {
        header Content-Type application/json
        header Cache-Control "no-store"
        respond `RESPONSE_JSON` 503
    }

'''.replace('RESPONSE_JSON', json.dumps({'ok': False, 'error': ERROR}, separators=(',', ':')))


def prepare(baseline: bytes) -> bytes:
    """Return a candidate only for the exact reviewed live baseline."""
    if hashlib.sha256(baseline).hexdigest() != BASELINE_SHA256:
        raise ValueError('Baseline changed; re-inspect live configuration before proceeding.')
    text = baseline.decode('utf-8')
    if text.count(ANCHOR) != 1:
        raise ValueError('Expected exactly one AFZ AI route insertion point.')
    candidate = text.replace(ANCHOR, BLOCK + ANCHOR, 1)
    protected = 'ptt-api.afzeng.ca {'
    if text.split(protected, 1)[1] != candidate.split(protected, 1)[1]:
        raise ValueError('Protected FamilyPTT configuration changed.')
    if candidate.replace(BLOCK, '', 1) != text:
        raise ValueError('Unexpected changes outside the reviewed insertion.')
    return candidate.encode('utf-8')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('baseline', type=Path)
    parser.add_argument('candidate', type=Path)
    args = parser.parse_args()
    baseline = args.baseline.resolve(strict=True)
    candidate = args.candidate.resolve()
    if candidate == baseline:
        parser.error('Use a separate staging output, never overwrite the baseline.')
    output = prepare(baseline.read_bytes())
    if candidate.exists():
        if candidate.read_bytes() != output:
            parser.error('Candidate already exists with different contents; refusing overwrite.')
    else:
        with candidate.open('xb') as stream:
            stream.write(output)
    print(json.dumps({'candidate': str(candidate), 'sha256': hashlib.sha256(output).hexdigest(),
                      'mail_delivery_restored': False, 'production_modified': False}))


if __name__ == '__main__':
    main()
