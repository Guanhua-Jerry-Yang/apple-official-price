#!/usr/bin/env python3
"""bootstrap_skus.py — list every SKU and its price from a page's PRODUCT_SELECTION_BOOTSTRAP dump.

iPhone (and other fixed-SKU products such as iPad) do not price by additive option deltas: the buy page
embeds one `products[]` record per sellable SKU with a `fullPrice` key into `displayValues.prices`, whose
`amountBeforeTradeIn` is the final price. So the whole price table can be read without a single click;
clicking through a few SKUs is only a cross-check. Get the dump with:
    run_crawl.sh cfg.json      where cfg has "planOnly": true   ->  <out>_structure.json

usage: bootstrap_skus.py <structure.json> [--out rows.tsv] [--unlocked-only] [--all-carriers]
  --unlocked-only  US iPhone: keep carrierModel == UNLOCKED/US (the SIM-free full price; default)
  --all-carriers   keep carrier-bound SKUs too (they carry the $30 connectivity discount on some models)
Also works for Mac-style bootstraps: prints the base price of every chip tier (priceKey -> amount).
"""
import sys, json, csv, argparse

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('structure'); ap.add_argument('--out'); ap.add_argument('--all-carriers', action='store_true')
    a = ap.parse_args()
    d = json.load(open(a.structure, encoding='utf-8'))
    psd = d.get('productSelectionData', d)
    prods = psd.get('products') or []
    prices = (psd.get('displayValues') or psd.get('mainDisplayValues') or {}).get('prices') or {}
    rows = []
    if prods and 'fullPrice' in prods[0]:                       # iPhone / iPad style: one record per SKU
        dims = [k for k in prods[0] if k.startswith('dimension') and k != 'dimensionSteporder'] + (['carrierModel'] if 'carrierModel' in prods[0] else [])
        for p in prods:
            if not a.all_carriers and p.get('carrierModel') and not str(p['carrierModel']).upper().startswith('UNLOCKED'): continue
            pr = prices.get(p.get('fullPrice')) or {}
            amt = pr.get('amountBeforeTradeIn') or pr.get('amount') or pr.get('seoPrice') or (pr.get('currentPrice') or {}).get('raw_amount')
            try: amt = int(round(float(amt)))
            except (TypeError, ValueError): pass
            rows.append({**{k: p.get(k, '') for k in dims}, 'partNumber': p.get('partNumber', ''), 'priceKey': p.get('fullPrice', ''),
                         'currency': pr.get('priceCurrency', ''), 'amount': amt, 'comingSoon': p.get('comingSoon', ''), 'total_raw': str(amt)})
        cols = dims + ['partNumber', 'priceKey', 'currency', 'total_raw', 'amount', 'comingSoon']
    else:                                                        # Mac style: base price per chip tier
        for k, v in prices.items():
            amt = v.get('amount') or v.get('seoPrice') or (v.get('currentPrice') or {}).get('raw_amount')
            rows.append({'priceKey': k, 'total_raw': (v.get('currentPrice') or {}).get('amount', ''), 'amount': amt})
        cols = ['priceKey', 'total_raw', 'amount']
    rows.sort(key=lambda r: [str(r.get(c, '')) for c in cols])
    out = open(a.out, 'w', newline='', encoding='utf-8') if a.out else sys.stdout
    w = csv.DictWriter(out, fieldnames=cols, delimiter='\t', extrasaction='ignore'); w.writeheader(); w.writerows(rows)
    if a.out: print(f'{len(rows)} rows -> {a.out}')

if __name__ == '__main__':
    main()
