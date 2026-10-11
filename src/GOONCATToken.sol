// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title GOONCAT
/// @notice Fixed-supply token with a fixed 2% tax on transfers out of the v4 PoolManager.
/// @dev The launch factory handles swarm distribution, liquidity and platform fees externally.
contract GOONCATToken is ERC20 {
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant BUY_TAX_BPS = 200;
    uint256 private constant BPS_DENOMINATOR = 10_000;
    address public constant POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;
    address public constant TREASURY = 0xFec44feFbC7B83Ce9Be3A36d647D36f45CFF59E2;

    constructor() ERC20("GOONCAT", "GOONCAT") {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    /// @dev Destination exemption takes priority, including PoolManager self-transfers.
    /// The PoolManager loses exactly `value`; the recipient and treasury share that amount.
    /// All divisions round down in token minor units. No external calls are made.
    function _update(address from, address to, uint256 value) internal override {
        if (from == POOL_MANAGER && to != POOL_MANAGER) {
            // Check the gross amount before splitting it, even when the treasury is the buyer.
            uint256 available = balanceOf(from);
            if (available < value) revert ERC20InsufficientBalance(from, available, value);

            // Exactly floor(value * 200 / 10_000), without an intermediate multiplication.
            uint256 fee = value / (BPS_DENOMINATOR / BUY_TAX_BPS);
            if (fee != 0) super._update(from, TREASURY, fee);
            value -= fee;
        }
        super._update(from, to, value);
    }
}
