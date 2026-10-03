#!/usr/bin/env python3
"""Generate the HP Envy loopback contact route without writing live configuration."""
import argparse
import hashlib
from pathlib import Path
BASELINE = 'fb5caf46ca92536900759ad29ee1384815d6bc284c5b3da8de8556ed7db2c35c'
OLD = b'reverse_proxy 100.106.186.118:8510 {'
NEW = b'reverse_proxy 127.0.0.1:8510 {'
OLD_COMMENT = b'# Private H3 mail worker; the public website remains on HP Envy.'
NEW_COMMENT = b'# HP Envy local mail worker; no H3 or recovered-drive dependency.'
def generate(source: bytes) -> bytes:
    if hashlib.sha256(source).hexdigest() != BASELINE:
        raise ValueError('Baseline changed; refresh and reconcile before deployment.')
    if source.count(OLD) != 1 or source.count(OLD_COMMENT) != 1:
        raise ValueError('Expected contact upstream or comment is not unique.')
    result = source.replace(OLD, NEW, 1).replace(OLD_COMMENT, NEW_COMMENT, 1)
    if result.replace(NEW, OLD, 1).replace(NEW_COMMENT, OLD_COMMENT, 1) != source:
        raise ValueError('Unexpected unrelated change.')
    return result
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error('Use a separate candidate file, never the live input.')
    candidate = generate(args.input.read_bytes())
    with args.output.open('xb') as out: out.write(candidate)
    print('candidate_sha256=' + hashlib.sha256(candidate).hexdigest())
