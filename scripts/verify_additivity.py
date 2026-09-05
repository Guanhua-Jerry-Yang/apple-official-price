#!/usr/bin/env python3
"""verify_additivity.py — check that every crawled total equals  base + Σ(option deltas).

Apple prices configurations additively: a tier's base price plus a fixed delta per memory / storage /
ethernet option. A row that breaks the rule is either a stale price read (page had not updated yet when
the total was read) or a genuine pricing quirk (e.g. MacBook Air 13" 10-core-GPU tier's $100 premium
vanishes once you upgrade memory or storage). Either way it must be re-read once before it is trusted.

usage: verify_additivity.py <rows.tsv> [--group COL,COL] [--dims COL,COL] [--out report.md]
  --group   columns that define a "tier" sharing one base price (default: every dimension whose name
            looks structural: *Chip*, *cpuCore*, *Screensize*, *dimensionModel*)
  --dims    option dimensions with additive deltas (default: all other dimension columns)
Exit code 0 when all rows are additive, 2 when mismatches exist.
"""
import csv, sys, json, re, argparse

STRUCTURAL = re.compile(r'Chip|cpuCore|Screensize|dimensionModel|connectivity|Model', re.I)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('rows'); ap.add_argument('--group'); ap.add_argument('--dims'); ap.add_argument('--out')
    a = ap.parse_args()
    rows = list(csv.DictReader(open(a.rows, encoding='utf-8'), delimiter='\t'))
    if not rows: print('no rows'); sys.exit(1)
    cols = list(rows[0].keys())
    dim_cols = cols[:cols.index('total_raw')] if 'total_raw' in cols else [c for c in cols if c not in ('amount',)]
    group = a.group.split(',') if a.group else [c for c in dim_cols if STRUCTURAL.search(c)]
    dims = a.dims.split(',') if a.dims else [c for c in dim_cols if c not in group]
    # value order = first appearance in file (matches page order)
    order = {d: [] for d in dims}
    for r in rows:
        for d in dims:
            if r[d] not in order[d]: order[d].append(r[d])
    def amt(r):
        try: return int(round(float(r['amount'])))
        except: return None
    price = {tuple(r[c] for c in group + dims): amt(r) for r in rows}
    report = []; mismatches = []; tiers = {}
    for gk in sorted({tuple(r[c] for c in group) for r in rows}):
        sub = {k[len(group):]: v for k, v in price.items() if k[:len(group)] == gk and v is not None}
        if not sub: continue
        # base = lowest option on every dimension that this tier actually offers
        offered = {d: [v for v in order[d] if any(k[i] == v for k in sub for i in [dims.index(d)])] for d in dims}
        base_key = tuple(offered[d][0] for d in dims)
        if base_key not in sub:
            report.append(f'- {gk}: base combination {base_key} missing, skipped'); continue
        base = sub[base_key]
        deltas = {}
        for i, d in enumerate(dims):
            deltas[d] = {}
            for v in offered[d]:
                k = list(base_key); k[i] = v
                if tuple(k) in sub: deltas[d][v] = sub[tuple(k)] - base
        bad = []
        for k, v in sub.items():
            try: pred = base + sum(deltas[d][k[i]] for i, d in enumerate(dims))
            except KeyError: continue
            if pred != v: bad.append((k, v, pred))
        tiers['|'.join(gk)] = {'base': base, 'deltas': deltas, 'rows': len(sub), 'mismatches': len(bad)}
        report.append(f'- **{" / ".join(gk)}**: base {base}, rows {len(sub)}, mismatches {len(bad)}; deltas ' + json.dumps(deltas, ensure_ascii=False))
        for k, v, pred in bad:
            mismatches.append((gk, k, v, pred)); report.append(f'    - MISMATCH {k}: read {v}, expected {pred} (diff {v - pred})')
    md = f'# additivity check — {a.rows}\n\ngroup = {group}\ndims = {dims}\nrows = {len(rows)}, mismatches = {len(mismatches)}\n\n' + '\n'.join(report) + '\n'
    if a.out: open(a.out, 'w', encoding='utf-8').write(md)
    print(md)
    sys.exit(2 if mismatches else 0)

if __name__ == '__main__':
    main()
