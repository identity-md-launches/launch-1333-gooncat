# GOONCAT

The project includes the fixed-supply `GOONCATToken`, its launch manifest, offline Foundry
tests, five logo options in `logos/`, and the selected image-generated wallet logo at
`artifacts/logo.png`. See [the logo notes](logos/README.md) for the five approaches,
generation method, prompts, draft count and small-size review. The coin's website lives in
`site/` with its production export in `dist/` (see [Website](#website) below).

## Website

Static HTML, CSS and JS with no build step: `site/index.html` (home) and `site/404.html`,
assets under `site/assets/`. Published at https://gooncat.si-md.xyz. `dist/` is a byte-for-byte
copy of `site/` and is what the publisher serves; asset URLs on the home page are relative so
the export also works at a gateway subpath. The design system is documented in
[DESIGN.md](DESIGN.md); the review and check record is in
[artifacts/validation.md](artifacts/validation.md).

Live data: the page fetches `/simd-coin.json` on its own origin every 30 seconds and fills the
price, market cap, volume, status, contract address, Buy and Chart links and the city billboard
from it. Until that file answers, every live field shows "launching…" and the contract copy
button explains that the address appears after launch. Nothing is hardcoded. If the JSON carries
a `logo` field, it replaces the bundled logo.

### Install

Node 18 or newer is the only requirement; the tooling in `web/` has no npm dependencies
(`web/package-lock.json` is empty on purpose). Nothing to install for the site itself.

### Preview

```sh
node web/build.mjs                 # export site/ -> dist/
node web/preview.mjs 4173          # serve dist/ at http://127.0.0.1:4173/ (Ctrl+C to stop)
node web/preview.mjs 4173 --sample # same, plus a sample /simd-coin.json to see the live states
```

Editing files in `site/` and re-running the build updates what the preview serves.

### Rebuild and check

```sh
node web/build.mjs                                               # production export
npx --yes --package typescript@5.6.3 tsc -p web/tsconfig.json    # typecheck app.js (checkJs, strict)
node web/check.mjs                                               # offline checks: files, relative URLs, meta, served export, 404, contrast
```

Or from `web/`: `npm run build`, `npm run typecheck`, `npm run check`, `npm run preview`.
Results of the last run are recorded in `artifacts/validation.md` together with the headless
browser pass at 320, 390 and 1440 px (menu, tabs, copy, live-data mock, PNG export, city,
votes, share links, reduced motion, 404).

### Publish

Commit `site/`, `dist/`, `web/` and the docs. The launch pipeline pins the committed `dist/`
and serves it at the site's name; no publishing command is run from this repository. To
publish elsewhere, upload the contents of `dist/` to any static host and serve `404.html`
for unknown paths (the site expects `/simd-coin.json` to be provided by the host).

## Token behavior

The constructor takes no arguments and mints exactly 1,000,000,000 GOONCAT with 18 decimals
(`1000000000000000000000000000` minor units) to its caller. It performs no allocation or
external call. There is no owner, admin, additional mint entry point, burn entry point,
proxy or upgrade mechanism.

A transfer **from** `0x000000000004444c5dc75cB358380D2e3dE08A90` charges 2% of the gross
amount, rounded down to whole minor units. The fee immediately credits
`0xFec44feFbC7B83Ce9Be3A36d647D36f45CFF59E2`; the recipient receives the remainder.
The PoolManager loses exactly the gross amount. Transfers **to** the PoolManager are
always untaxed, including seeding, sells and PoolManager self-transfers. Other transfers
are untaxed. The same rule applies to `transferFrom`, whose allowance covers the gross
amount. Rate and addresses are constants.

The rule classifies transfers by address, as requested: it also applies to liquidity
withdrawals or other token payouts from that PoolManager. Consumers must account for
the recipient's net amount. Amounts below 50 minor units round to a zero fee.

The factory handles the 10% swarm distribution and the 90% pool allocation externally;
the launch platform collects its 1% fee externally. The token does not implement either
charge. The manifest pins the IMD pair, pool fee of 12500 (1.25%), tick spacing of 60,
2,500 IMD opening market cap and the specified remainder recipient. The provenance price
is copied exactly from the brief; the factory derives the actual opening price using
deployed currency order. The pool fee is a pool configuration, not a second token tax.

## Build and validation

```sh
forge build
forge test
```

Solidity is pinned to 0.8.26, targeting Cancun with optimization and `bytecode_hash = "none"`.
All imported sources are vendored as ordinary files under `lib/`, with upstream licenses
and version provenance. No dependency download, RPC URL, environment file, FFI or filesystem
permission is needed. Build output goes to `out/`, separate from the delivered logo.

Local validation passed: 18 unit/fuzz tests plus one stateful invariant test, including
1,000 runs for each of two fuzz properties and 256 sequences of 64 invariant calls
(16,384 calls, zero reverts). Coverage includes full constructor allocation, swarm claims,
tax-free seeding and sells, gross/net buy accounting, emitted events, fee rounding,
delegated transfers, allowance rollback, treasury and PoolManager self-transfer cases,
invalid recipients, unavailable admin entry points, supply conservation and runtime
checks for forbidden opcodes.

The local settlement probe checks the PoolManager's exact incoming and outgoing token
balance requirements at its specified address. It is not the actual Uniswap AMM.
No live-chain fork, transaction or deployment was performed. The supplied protected
launch test was reviewed; running it requires the verifier's factory helpers and resolved
launch environment, which were not part of the supplied checkout. Actual v4 pool
initialization and swap execution remain for that protected harness or a separate fork run.
