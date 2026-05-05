#!/usr/bin/env python3
"""
Fix camelCase property accesses in src/views/Reports.jsx so they fall back to
snake_case (which is what Supabase actually returns from the REST API).

Pattern: every `obj.camelCase` access becomes `obj.snake_case || obj.camelCase`.
For accesses used in `&&`/`!` contexts where operator precedence matters, the
fallback is wrapped in parens.

Idempotent — safe to run multiple times. Creates a .bak backup before writing.

Usage (from trade-pa/ root):
    python3 fix_reports_camelcase.py            # apply fixes
    python3 fix_reports_camelcase.py --dry-run  # preview only
"""

import re
import sys
from pathlib import Path

# (regex pattern with word boundaries, snake form, camel form, wrap_in_parens)
PAIRS = [
    (r'\bm\.unitPrice\b',       'm.unit_price',       'm.unitPrice',       False),
    (r'\bi\.grossAmount\b',     'i.gross_amount',     'i.grossAmount',     False),
    (r'\bq\.grossAmount\b',     'q.gross_amount',     'q.grossAmount',     False),
    (r'\bi\.cisDeduction\b',    'i.cis_deduction',    'i.cisDeduction',    False),
    (r'\bi\.cisNetPayable\b',   'i.cis_net_payable',  'i.cisNetPayable',   False),
    # vatEnabled needs parens — appears in `vatEnabled && !vatZeroRated` where
    # operator precedence would otherwise short-circuit past the AND check.
    (r'\bi\.vatEnabled\b',      'i.vat_enabled',      'i.vatEnabled',      True),
    (r'\bj\.dateObj\b',         'j.date_obj',         'j.dateObj',         False),
    (r'\ba\.dateObj\b',         'a.date_obj',         'a.dateObj',         False),
    (r'\bb\.dateObj\b',         'b.date_obj',         'b.dateObj',         False),
    (r'\blastJob\.dateObj\b',   'lastJob.date_obj',   'lastJob.dateObj',   False),
    (r'\blastJob\?\.dateObj\b', 'lastJob?.date_obj',  'lastJob?.dateObj',  False),
]

# Special: !i.vatZeroRated becomes !(i.vat_zero_rated || i.vatZeroRated).
# Without the parens, !a || b parses as (!a) || b — wrong.
VAT_ZR_COLLAPSED = r'!\(i\.vat_zero_rated \|\| i\.vatZeroRated\)'
VAT_ZR_PATTERN   = r'!\s*i\.vatZeroRated\b'
VAT_ZR_REPLACE   = '!(i.vat_zero_rated || i.vatZeroRated)'


def main():
    filepath = Path('src/views/Reports.jsx')
    if not filepath.exists():
        print(f"ERROR: {filepath} not found. Run from trade-pa/ root.", file=sys.stderr)
        sys.exit(1)

    dry_run = '--dry-run' in sys.argv

    text = filepath.read_text()
    original = text
    changes_per_pair = {}

    for pattern, snake, camel, wrap in PAIRS:
        fallback = f'({snake} || {camel})' if wrap else f'{snake} || {camel}'
        # Idempotency: collapse any existing fallback first
        text = text.replace(fallback, camel)
        # Apply with word-boundary regex
        text, count = re.subn(pattern, fallback, text)
        if count:
            changes_per_pair[f'{camel} → {fallback}'] = count

    # Special case for !i.vatZeroRated
    text = re.sub(VAT_ZR_COLLAPSED, '!i.vatZeroRated', text)
    text, vz_count = re.subn(VAT_ZR_PATTERN, VAT_ZR_REPLACE, text)
    if vz_count:
        changes_per_pair[f'!i.vatZeroRated → {VAT_ZR_REPLACE}'] = vz_count

    if text == original:
        print("No changes needed — Reports.jsx is already up to date.")
        return

    print(f"Changes to apply ({sum(changes_per_pair.values())} sites):")
    for change, count in changes_per_pair.items():
        print(f"  [{count:2}x]  {change}")

    if dry_run:
        print("\n--dry-run: not writing. Re-run without --dry-run to apply.")
        return

    backup = filepath.with_suffix(filepath.suffix + '.bak')
    backup.write_text(original)
    filepath.write_text(text)

    print(f"\nApplied to {filepath}")
    print(f"Backup: {backup}")
    print()
    print("Verify diff:")
    print(f"  diff {backup} {filepath} | head -80")
    print()
    print("Compile-check:")
    print(f"  npx esbuild {filepath} --bundle=false --log-level=error --loader:.jsx=jsx > /dev/null && echo OK")
    print()
    print("If compile passes, deploy and refresh the Tax Year 2025/26 report.")


if __name__ == '__main__':
    main()
