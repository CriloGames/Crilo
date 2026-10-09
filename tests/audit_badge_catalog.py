#!/usr/bin/env python3
"""Crilo badge catalog static audit. Read-only; never connects to production."""
import argparse
import collections
import json
import sys
from pathlib import Path

def audit(catalog, expected=133):
    errors = []
    keys = [b.get("badge_key") for b in catalog]
    duplicates = [key for key, count in collections.Counter(keys).items() if count > 1]
    if duplicates:
        errors.append("Duplicate badge keys: " + ", ".join(map(str, duplicates)))
    if len(catalog) != expected:
        errors.append(f"Expected {expected} badges, found {len(catalog)}")
    for index, badge in enumerate(catalog):
        for field in ("badge_key", "name", "description", "category"):
            if not isinstance(badge.get(field), str) or not badge[field].strip():
                errors.append(f"Badge #{index + 1}: missing {field}")
    return errors

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("catalog", type=Path, help="JSON array exported from public.badges")
    parser.add_argument("--expected", type=int, default=133)
    args = parser.parse_args()
    data = json.loads(args.catalog.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        parser.error("Catalog must be a JSON array")
    problems = audit(data, args.expected)
    print(f"Audited {len(data)} badge definitions")
    for problem in problems:
        print("FAIL:", problem)
    if problems:
        sys.exit(1)
    print("PASS: catalog count, unique keys, and required fields")
    print("NOTE: This does NOT certify attainability or database awards.")

if __name__ == "__main__":
    main()
