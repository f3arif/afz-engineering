#!/usr/bin/env python3
"""Run interactively on the ZBook; secrets never appear in command arguments or output."""
import getpass
import json
import os
from pathlib import Path
import secrets
from urllib.parse import urlsplit

root = Path.home() / '.config' / 'afz-engineering-auth0'
root.mkdir(mode=0o700, parents=True, exist_ok=True)
settings = root / 'settings.json'
if settings.exists():
    raise SystemExit('Private configuration already exists. Preserve it; edit it locally instead of overwriting it.')
issuer = input('Auth0 tenant origin (https://...): ').strip().rstrip('/')
base = input('Pilot origin [http://localhost:19870]: ').strip().rstrip('/') or 'http://localhost:19870'
for value, is_issuer in [(issuer, True), (base, False)]:
    p = urlsplit(value)
    local = p.hostname in ('localhost', '127.0.0.1', '::1')
    if not p.hostname or p.username or p.password or p.path or p.query or p.fragment or not (p.scheme == 'https' or (not is_issuer and local and p.scheme == 'http')):
        raise SystemExit('Invalid origin. Use HTTPS, or loopback HTTP for the pilot only.')
client = input('Regular Web Application client ID: ').strip()
secret = getpass.getpass('Auth0 client secret (hidden): ').strip()
if not client or not secret:
    raise SystemExit('Client ID and secret are required.')
data = {'AUTH0_ISSUER_BASE_URL': issuer, 'PILOT_BASE_URL': base,
        'AUTH0_CLIENT_ID': client, 'AUTH0_CLIENT_SECRET': secret,
        'AUTH0_SESSION_SECRET': secrets.token_hex(32)}
with os.fdopen(os.open(settings, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as f:
    json.dump(data, f, indent=2)
members = root / 'memberships.json'
if not members.exists():
    with os.fdopen(os.open(members, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as f:
        f.write('{}\n')
print('Private configuration saved. No project access is granted yet. Add Auth0 user subjects to the owner-only membership file, then restart the pilot.')
