#!/usr/bin/env python3
"""Generate only the contact upstream change; never reload or overwrite live config."""
import argparse
import hashlib
from pathlib import Path

BASELINE_SHA256 = 'ddb92e8c7c8755f229438861d2b85c0761b45571b55c558d49af08f12c150828'
OLD = '''    # Temporary fail-closed response, not a working mail backend.
    @afz_contact_unavailable path /api/contact
    handle @afz_contact_unavailable {
        header Content-Type application/json
        header Cache-Control "no-store"
        respond `{"ok":false,"error":"Online enquiries are temporarily unavailable. Your message has not been sent. Please email design@afzeng.ca or call 647-812-4119."}` 503
    }
'''
NEW = '''    # Private H3 mail worker; the public website remains on HP Envy.
    @afz_contact path /api/contact
    handle @afz_contact {
        header Cache-Control "no-store"
        reverse_proxy 100.106.186.118:8510 {
            header_up X-AFZ-Client-IP {http.request.remote.host}
            header_up X-Forwarded-For {http.request.remote.host}
            transport http {
                dial_timeout 4s
                response_header_timeout 35s
            }
        }
    }
'''

def generate(source: bytes) -> bytes:
    if hashlib.sha256(source).hexdigest() != BASELINE_SHA256:
        raise ValueError('Live baseline changed; refresh and reconcile instead of overwriting.')
    old, new = OLD.encode(), NEW.encode()
    if source.count(old) != 1:
        raise ValueError('Expected contact mitigation block is not unique.')
    candidate = source.replace(old, new, 1)
    if candidate.replace(new, old, 1) != source:
        raise ValueError('Unrelated configuration changed.')
    return candidate

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error('Output must be a separate candidate file.')
    candidate = generate(args.input.read_bytes())
    with args.output.open('xb') as output:
        output.write(candidate)
    print('candidate_sha256=' + hashlib.sha256(candidate).hexdigest())
    print('Generated only. Validation and explicitly targeted deployment remain separate.')

if __name__ == '__main__':
    main()
