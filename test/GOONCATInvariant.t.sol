// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {GOONCATToken} from "../src/GOONCATToken.sol";

contract TokenHandler is Test {
    GOONCATToken public immutable token;
    address[] private accounts;
    uint256 public expectedTreasury;
    uint256 public successfulTransfers;

    constructor(GOONCATToken token_) {
        token = token_;
        accounts.push(address(this));
        accounts.push(makeAddr("invariant-alice"));
        accounts.push(makeAddr("invariant-bob"));
        accounts.push(token.POOL_MANAGER());
        accounts.push(token.TREASURY());
    }

    function move(uint256 fromIndex, uint256 toIndex, uint256 value, bool delegated) external {
        address from = accounts[fromIndex % accounts.length];
        address to = accounts[toIndex % accounts.length];
        value = bound(value, 0, token.balanceOf(from));

        uint256 fee;
        if (from == token.POOL_MANAGER() && to != token.POOL_MANAGER()) fee = value * 2 / 100;
        uint256 net = value - fee;
        if (from == token.TREASURY()) expectedTreasury -= value;
        if (to == token.TREASURY()) expectedTreasury += net;
        expectedTreasury += fee;

        if (delegated) {
            vm.prank(from);
            token.approve(address(this), value);
            token.transferFrom(from, to, value);
        } else {
            vm.prank(from);
            token.transfer(to, value);
        }
        ++successfulTransfers;
    }

    function accountedSupply() external view returns (uint256 sum) {
        for (uint256 i; i < accounts.length; ++i) {
            sum += token.balanceOf(accounts[i]);
        }
    }
}

contract GOONCATInvariantTest is Test {
    GOONCATToken private token;
    TokenHandler private handler;

    function setUp() public {
        token = new GOONCATToken();
        handler = new TokenHandler(token);
        token.transfer(address(handler), token.totalSupply());
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = TokenHandler.move.selector;
        targetSelector(FuzzSelector(address(handler), selectors));
        targetContract(address(handler));
    }

    /// forge-config: default.invariant.runs = 256
    /// forge-config: default.invariant.depth = 64
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_FixedSupplyIsConservedAndFeesReachOnlyTreasury() public view {
        assertEq(token.totalSupply(), 1_000_000_000e18);
        assertEq(handler.accountedSupply(), token.totalSupply());
        assertEq(token.balanceOf(token.TREASURY()), handler.expectedTreasury());
        assertEq(token.balanceOf(address(0)), 0);
    }
}
