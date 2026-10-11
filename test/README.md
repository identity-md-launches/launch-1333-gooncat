# GOONCAT tests

Run `forge build` and `forge test` from the repository root. No RPC, environment
variables, FFI, dependency installation or configuration changes are required.
Fuzz tests use Foundry's default run count. The bounded invariant uses 256 runs
of 64 actions, with unexpected handler reverts treated as failures.

## Coverage

- `GOONCATToken.t.sol` retains the earlier contributor's unit suite and extends
  its edge cases: all supply to the actual constructor caller, 18 decimals,
  fixed parameters, external swarm distribution, two-percent buy tax, rounding,
  treasury collisions, untaxed sells/wallet transfers, events, delegated buys,
  finite/infinite/revoked allowances, overdraws, invalid recipients, maximum
  inputs, mint/burn/admin rejection and forbidden runtime opcodes.
- `GOONCATInvariant.t.sol` keeps an independent ledger for every tracked holder
  and allowance. Random actions interleave transfers, buys, sells, approvals,
  revocations, delegated spending and deliberately rejected operations. Checks
  cover each individual balance, each allowance, total balance conservation,
  fixed supply, treasury accounting and constant parameters. Actors include
  the treasury and PoolManager, so self-transfers and overlapping roles occur.
- `GOONCATPoolManager.t.sol` runs a real, pinned Uniswap v4 PoolManager locally at
  `0x000000000004444c5dc75cB358380D2e3dE08A90`. Its constructor runs at that address
  to preserve the `NoDelegateCall` immutable. Only IMD is a test ERC20, at the
  required pair address. Both currency orderings use the 2500 IMD market cap,
  12500 fee, 60 tick spacing, external 10% swarm allocation and a single-sided
  seed from the 90% budget. Liquidity rounding dust goes to the specified
  remainder recipient. Tests execute exact-input and exact-output swaps in both
  directions, routed output, LP fee collection, and a treasury recipient.
  They also check atomic rollback on one-wei underpayment, insufficient sell
  allowance and minimum-output failure, including pool price and fee growth.
  Successful operations leave zero open currency deltas and the manager locked.

The launch platform's 1% fee and Merkle proof validation are external mechanisms;
this token suite checks that token transfers do not deduct their own additional
platform fee and that swarm allocation/claim transfers arrive whole. The local
router is test scaffolding, not a production router or launch factory.

M1 classifies transfers by their source address. Therefore a GOONCAT LP fee
withdrawal from PoolManager also incurs the 2% tax. Exact-output swaps specify
gross pool output; the receiver's net amount is lower by the tax. The slippage
test explicitly checks net balance changes and rollback instead of claiming
that a receiver gets the gross amount.

Dependencies, pins, licenses and the one relative-import adjustment are recorded
in [vendor/README.md](vendor/README.md). All dependency sources are ordinary files
under `test/vendor/`; none are submodules or loaded from scratch space.

## Limits

These tests exercise local v4 core, not live mainnet state. A mainnet fork run
against the deployed IMD implementation, actual launch factory/initialization
hook/Merkle distributor and production router remains outside this offline
suite. No tests are silently skipped when an RPC URL is absent.
