// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {GOONCATToken} from "../src/GOONCATToken.sol";

contract TokenHandler is Test {
    uint256 private constant SUPPLY = 1_000_000_000e18;
    address private constant MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;
    address private constant TREASURY = 0xFec44feFbC7B83Ce9Be3A36d647D36f45CFF59E2;
    GOONCATToken public immutable token;
    address[] private accounts;
    mapping(address => uint256) public expectedBalance;
    mapping(address => mapping(address => uint256)) public expectedAllowance;
    uint256 public expectedTreasury;
    uint256 public successfulTransfers;
    uint256 public rejectedTransfers;

    constructor(GOONCATToken token_) {
        token = token_;
        accounts.push(address(this));
        accounts.push(makeAddr("invariant-alice"));
        accounts.push(makeAddr("invariant-bob"));
        accounts.push(MANAGER);
        accounts.push(TREASURY);
        expectedBalance[address(this)] = SUPPLY;
    }

    function move(uint256 fromIndex, uint256 toIndex, uint256 value, bool delegated) external {
        address from = accounts[fromIndex % accounts.length];
        address to = accounts[toIndex % accounts.length];
        value = bound(value, 0, expectedBalance[from]);

        if (delegated) {
            _approve(from, address(this), value);
            assertTrue(token.transferFrom(from, to, value));
            expectedAllowance[from][address(this)] -= value;
        } else {
            vm.prank(from);
            assertTrue(token.transfer(to, value));
        }
        _recordTransfer(from, to, value);
    }

    /// @dev Approvals persist into later random actions, including overwrite/revoke
    /// and infinite approval. The spender need not be the handler or token owner.
    function approve(uint256 ownerIndex, uint256 spenderIndex, uint256 value, bool unlimited) external {
        address owner = accounts[ownerIndex % accounts.length];
        address spender = accounts[spenderIndex % accounts.length];
        _approve(owner, spender, unlimited ? type(uint256).max : bound(value, 0, SUPPLY));
    }

    function revoke(uint256 ownerIndex, uint256 spenderIndex) external {
        _approve(accounts[ownerIndex % accounts.length], accounts[spenderIndex % accounts.length], 0);
    }

    function spend(uint256 ownerIndex, uint256 toIndex, uint256 spenderIndex, uint256 value) external {
        address owner = accounts[ownerIndex % accounts.length];
        address to = accounts[toIndex % accounts.length];
        address spender = accounts[spenderIndex % accounts.length];
        uint256 allowed = expectedAllowance[owner][spender];
        uint256 maximum = expectedBalance[owner] < allowed ? expectedBalance[owner] : allowed;
        value = bound(value, 0, maximum);
        vm.prank(spender);
        assertTrue(token.transferFrom(owner, to, value));
        if (allowed != type(uint256).max) expectedAllowance[owner][spender] -= value;
        _recordTransfer(owner, to, value);
    }

    /// @dev Failed operations must preserve the entire ghost ledger, including
    /// already-accrued treasury fees and the gross allowance. Each branch has an
    /// exact expected ERC20 error; unexpected success cannot disappear as a discard.
    function reject(uint256 fromIndex, uint256 toIndex, uint256 value, uint8 mode) external {
        address from = accounts[fromIndex % accounts.length];
        address to = accounts[toIndex % accounts.length];
        uint256 held = expectedBalance[from];
        if (mode % 3 == 0) {
            value = held + bound(value, 1, SUPPLY);
            _approve(from, address(this), value);
            vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, from, held, value));
            token.transferFrom(from, to, value);
        } else if (mode % 3 == 1) {
            value = bound(value, 0, held);
            _approve(from, address(this), value);
            vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
            token.transferFrom(from, address(0), value);
        } else {
            value = bound(value, 1, SUPPLY);
            _approve(from, address(this), value - 1);
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC20Errors.ERC20InsufficientAllowance.selector, address(this), value - 1, value
                )
            );
            token.transferFrom(from, to, value);
        }
        ++rejectedTransfers;
    }

    function _approve(address owner, address spender, uint256 value) private {
        vm.prank(owner);
        assertTrue(token.approve(spender, value));
        expectedAllowance[owner][spender] = value;
    }

    function _recordTransfer(address from, address to, uint256 value) private {
        uint256 fee = from == MANAGER && to != MANAGER ? value * 2 / 100 : 0;
        // Debit before credit handles self-transfers and treasury recipients.
        expectedBalance[from] -= value;
        expectedBalance[to] += value - fee;
        expectedBalance[TREASURY] += fee;
        expectedTreasury = expectedBalance[TREASURY];
        ++successfulTransfers;
    }

    function assertModel() external view {
        for (uint256 i; i < accounts.length; ++i) {
            assertEq(token.balanceOf(accounts[i]), expectedBalance[accounts[i]], "holder's balance differs from ledger");
            for (uint256 j; j < accounts.length; ++j) {
                assertEq(
                    token.allowance(accounts[i], accounts[j]),
                    expectedAllowance[accounts[i]][accounts[j]],
                    "allowance differs from gross spending ledger"
                );
            }
        }
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
        // Fund wallets and PoolManager immediately so random sequences start with
        // useful buys, sells and wallet transfers instead of mostly zero balances.
        handler.move(0, 1, 200_000_000e18, false);
        handler.move(0, 2, 200_000_000e18, false);
        handler.move(0, 3, 500_000_000e18, false);
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = TokenHandler.move.selector;
        selectors[1] = TokenHandler.approve.selector;
        selectors[2] = TokenHandler.revoke.selector;
        selectors[3] = TokenHandler.spend.selector;
        selectors[4] = TokenHandler.reject.selector;
        targetSelector(FuzzSelector(address(handler), selectors));
        targetContract(address(handler));
    }

    /// forge-config: default.invariant.runs = 256
    /// forge-config: default.invariant.depth = 64
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_FixedSupplyIsConservedAndFeesReachOnlyTreasury() public view {
        handler.assertModel();
        assertEq(token.totalSupply(), 1_000_000_000e18);
        assertEq(handler.accountedSupply(), token.totalSupply());
        assertEq(token.balanceOf(token.TREASURY()), handler.expectedTreasury());
        assertEq(token.balanceOf(address(0)), 0);
        assertEq(token.balanceOf(address(token)), 0);
        assertEq(token.POOL_MANAGER(), 0x000000000004444c5dc75cB358380D2e3dE08A90);
        assertEq(token.TREASURY(), 0xFec44feFbC7B83Ce9Be3A36d647D36f45CFF59E2);
        assertEq(token.BUY_TAX_BPS(), 200);
    }

    function test_HandlerSequenceExercisesAllowanceRevocationAndFailureRecovery() public {
        handler.approve(3, 1, 10_000e18, false);
        handler.spend(3, 2, 1, 1000e18);
        handler.revoke(3, 1);
        handler.reject(3, 2, 100e18, 2);
        handler.reject(3, 4, 1, 0);
        handler.reject(3, 2, 100e18, 1);
        handler.approve(3, 4, 0, true);
        handler.spend(3, 4, 4, 1000e18);
        handler.move(4, 3, 500e18, false);
        handler.move(3, 3, 1e18, true);
        handler.move(1, 2, 200e18, true);
        invariant_FixedSupplyIsConservedAndFeesReachOnlyTreasury();
        assertGt(handler.successfulTransfers(), 3);
        assertEq(handler.rejectedTransfers(), 3);
    }
}
