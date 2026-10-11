# Offline Uniswap v4 test dependency

Only the transitive Solidity sources used by the integration tests are included.
These are ordinary files, not submodules; no install or RPC is needed to run tests.

- Uniswap v4-core `v4.0.0`, commit `e50237c43811bd9b526eff40f26772152a42daba`:
  https://github.com/Uniswap/v4-core/tree/e50237c43811bd9b526eff40f26772152a42daba
- Solmate (the submodule revision pinned by that release), commit `4b47a19038b798b4a33d9749d25e570443520647`:
  https://github.com/transmissions11/solmate/tree/4b47a19038b798b4a33d9749d25e570443520647

The only source change is the import in `v4-core/src/ProtocolFees.sol`:
`solmate/src/auth/Owned.sol` becomes `../../solmate/src/auth/Owned.sol` so the
project needs no remapping/configuration changes. Algorithm and protocol code
are unmodified. Original per-file SPDX identifiers and license texts are included.
The dependencies are used only for local, non-production tests.
