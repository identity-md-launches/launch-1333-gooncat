# GOONCAT

The project includes the fixed-supply `GOONCATToken`, its launch manifest, offline Foundry
tests, five logo options in `logos/`, and the selected image-generated wallet logo at
`artifacts/logo.png`. See [the logo notes](logos/README.md) for the five approaches,
generation method, prompts, draft count and small-size review.

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
