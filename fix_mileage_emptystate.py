#!/usr/bin/env python3
"""
Fix-up: Mileage.jsx empty state.

The Phase 2 patcher's OLD pattern for Mileage had the wrong surrounding
context (started with `      ) :` but the actual code has the loading
ternary opening on the same line, so the pattern never matched).

This patch matches ONLY the inner div line which is unambiguous, leaves
the surrounding ternary chain (`loading ? ... : trips.length === 0 ? (`)
intact, and adds the EmptyState import if missing.

Idempotent — safe to re-run.
"""

import pathlib, sys

p = pathlib.Path("trade-pa/src/views/Mileage.jsx")
if not p.exists():
    sys.exit("✗ Mileage.jsx not found — run from ~/Trade-PA")

src = p.read_text()
orig = src

# ── 1. Add EmptyState import if missing ────────────────────────────────────
if "import EmptyState" not in src:
    import_anchor = 'import { VoiceFillButton } from "../components/VoiceFillButton.jsx";'
    if import_anchor not in src:
        sys.exit("✗ Import anchor not found — Mileage.jsx may have been edited")
    src = src.replace(
        import_anchor,
        import_anchor + '\nimport EmptyState from "../components/EmptyState.jsx";',
        1,
    )
    print("  + EmptyState import added")
else:
    print("  ⊘ EmptyState import already present")

# ── 2. Replace the empty-state div ─────────────────────────────────────────
# Just the inner line. Surrounding ternary stays intact.
OLD = '        <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", textAlign: "center", padding: 32 }}>No trips logged yet — tap + Add Trip</div>'

NEW = '''        <EmptyState
          icon="mileage"
          title="No mileage logged"
          body="Average sole-trader misses about 30% of claimable miles. At 45p a mile, that adds up fast — claim every trip."
          ctaLabel="+ Log mileage"
          onCta={() => setShowAdd(true)}
          voiceTip={'Or say "Log 22 miles to the Mill Lane job today"'}
        />'''

if NEW.strip() in src:
    print("  ⊘ EmptyState already wired — nothing more to do")
elif OLD not in src:
    sys.exit("✗ Empty-state div pattern not matched — Mileage.jsx may have been edited since the audit")
else:
    src = src.replace(OLD, NEW, 1)
    print("  + Empty-state div → <EmptyState /> swap done")

# ── 3. Write if changed ────────────────────────────────────────────────────
if src == orig:
    print()
    print("⊘ No changes needed.")
else:
    p.write_text(src)
    print()
    print("✓ Mileage.jsx patched.")
    print()
    print("Verify:")
    print("  cd trade-pa && npx --yes esbuild src/views/Mileage.jsx --loader:.jsx=jsx --bundle=false > /dev/null && echo 'JSX OK'")
