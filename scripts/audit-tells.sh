#!/usr/bin/env bash
# audit-tells.sh — scan the repo for vibe-coded tells.
# Usage: bash audit-tells.sh [src-dir]   (default: app/ components/ src/)
# Output: docs/devibe/tells-report.txt + summary to stdout.

set -uo pipefail

DIRS="${1:-app components src}"
OUT="docs/devibe/tells-report.txt"
mkdir -p docs/devibe
: > "$OUT"

TOTAL=0

scan() { # scan <section> <label> <pattern>
  local section="$1" label="$2" pattern="$3"
  local hits
  hits=$(grep -rEn --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.css' \
    "$pattern" $DIRS 2>/dev/null | grep -v node_modules)
  local count
  count=$(printf '%s' "$hits" | grep -c . || true)
  TOTAL=$((TOTAL + count))
  {
    echo "== [$section] $label — $count hit(s)"
    [ "$count" -gt 0 ] && printf '%s\n' "$hits"
    echo
  } >> "$OUT"
  printf '%-4s %-55s %s\n' "[$section]" "$label" "$count"
}

echo "Scanning: $DIRS"
echo

# A — banned palette (should be ZERO after theme.css install)
scan A "indigo/purple/violet/fuchsia classes"      '(indigo|purple|violet|fuchsia)-[0-9]{2,3}'
scan A "raw hex colors in components"              '#[0-9a-fA-F]{6}\b'

# B — gradient/glow/glass decoration
scan B "background gradients"                      'bg-gradient-to-'
scan B "gradient text"                             'bg-clip-text'
scan B "glassmorphism (backdrop-blur)"             'backdrop-blur'
scan B "decorative blur orbs"                      'blur-(2xl|3xl)'
scan B "glow / colored shadows"                    'shadow-\[0_0|shadow-(brand|ember|orange|indigo|purple)'
scan B "pulse outside Skeleton"                    'animate-pulse'
scan B "infinite animations"                       'repeat: ?Infinity|infinite\]'

# C — component tells
scan C "colored left-border strips"                'border-l-(2|4|8)'
scan C "eyebrow pill badges / sparkles"            '✨|AI-powered|rounded-full[^"]*(badge|text-xs)'
scan C "emoji in JSX text"                         '>[^<]*[🔥🚀💪🎯⚡🎉😀-🙏]'
scan C "inline motion durations (not motion.ts)"   'duration: ?0\.|transition=\{\{'
scan C "bounce/elastic easing"                     'easeInOut|backOut|anticipate|bounce'

# D — copy tells
scan D "generic SaaS copy"                         'Supercharge|Seamless|Effortless|Everything you need|modern teams|Built for teams|best-in-class|cutting-edge'

# E — missing premium layer (informational: presence of the FIX, not the tell)
scan E "TODO/FIXME left in UI"                     'TODO|FIXME|placeholder'
scan E "div with onClick (a11y)"                   '<div[^>]*onClick'
scan E "bare error strings"                        'An error occurred|Something went wrong."?\}?</'

echo
echo "TOTAL hits: $TOTAL  (full report: $OUT)"
echo "Goal: sections A–D at zero. Section E items feed Phase 4."
