// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {GOONCATToken} from "../src/GOONCATToken.sol";

/// @dev Offline model of the balance accounting the PoolManager requires.
/// This is not an AMM: it checks exact incoming settlement and exact outgoing debits.
contract SettlementProbe {
    GOONCATToken private immutable token;

    constructor(GOONCATToken token_) {
        token = token_;
    }

    function settleFrom(address payer, uint256 amount) external {
        uint256 beforeBalance = token.balanceOf(address(this));
        require(token.transferFrom(payer, address(this), amount), "transfer failed");
        require(token.balanceOf(address(this)) - beforeBalance == amount, "incoming settlement short");
    }

    function take(address recipient, uint256 amount) external {
        uint256 beforeBalance = token.balanceOf(address(this));
        require(token.transfer(recipient, amount), "transfer failed");
        require(beforeBalance - token.balanceOf(address(this)) == amount, "outgoing debit mismatch");
    }
}

contract GOONCATTokenTest is Test {
    GOONCATToken internal token;
    SettlementProbe internal pool;
    uint256 internal constant SUPPLY = 1_000_000_000e18;
    address internal constant MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;
    address internal constant TREASURY = 0xFec44feFbC7B83Ce9Be3A36d647D36f45CFF59E2;
    address internal buyer;
    address internal spender;
    address internal distributor;

    event Transfer(address indexed from, address indexed to, uint256 value);

    function setUp() public {
        token = new GOONCATToken();
        buyer = makeAddr("buyer");
        spender = makeAddr("spender");
        distributor = makeAddr("distributor");
        SettlementProbe implementation = new SettlementProbe(token);
        vm.etch(MANAGER, address(implementation).code);
        pool = SettlementProbe(MANAGER);
    }

    function test_EntireFixedSupplyBelongsToDeployer() public view {
        assertEq(token.name(), "GOONCAT");
        assertEq(token.symbol(), "GOONCAT");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), SUPPLY);
        assertEq(token.balanceOf(address(this)), SUPPLY);
        assertEq(token.balanceOf(TREASURY), 0);
        assertEq(token.balanceOf(MANAGER), 0);
        assertEq(token.POOL_MANAGER(), MANAGER);
        assertEq(token.TREASURY(), TREASURY);
        assertEq(token.BUY_TAX_BPS(), 200);
    }

    function test_FactoryDistributionClaimSeedBuyAndSell() public {
        uint256 swarm = SUPPLY / 10;
        token.transfer(distributor, swarm);
        vm.prank(distributor);
        token.transfer(buyer, swarm);
        assertEq(token.balanceOf(buyer), swarm);
        assertEq(token.balanceOf(distributor), 0);

        uint256 seed = SUPPLY - swarm;
        token.approve(MANAGER, seed);
        pool.settleFrom(address(this), seed);
        assertEq(token.balanceOf(MANAGER), seed);
        assertEq(token.balanceOf(address(this)), 0);
        assertEq(token.balanceOf(TREASURY), 0);

        uint256 gross = 100_000e18;
        pool.take(buyer, gross);
        assertEq(token.balanceOf(buyer), swarm + 98_000e18);
        assertEq(token.balanceOf(TREASURY), 2_000e18);
        assertEq(token.balanceOf(MANAGER), seed - gross);

        vm.prank(buyer);
        token.approve(MANAGER, 98_000e18);
        pool.settleFrom(buyer, 98_000e18);
        assertEq(token.balanceOf(buyer), swarm);
        assertEq(token.balanceOf(MANAGER), seed - 2_000e18);
        assertEq(token.balanceOf(TREASURY), 2_000e18);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_BuyEmitsSeparateTreasuryAndBuyerTransfers() public {
        token.transfer(MANAGER, 100e18);
        vm.expectEmit(true, true, false, true, address(token));
        emit Transfer(MANAGER, TREASURY, 2e18);
        vm.expectEmit(true, true, false, true, address(token));
        emit Transfer(MANAGER, buyer, 98e18);
        pool.take(buyer, 100e18);
    }

    function test_BuyRoundingAtMinorUnitBoundaries() public {
        token.transfer(MANAGER, 10_000);
        uint256[7] memory amounts = [uint256(0), 1, 49, 50, 51, 99, 100];
        uint256[7] memory fees = [uint256(0), 0, 0, 1, 1, 1, 2];
        for (uint256 i; i < amounts.length; ++i) {
            uint256 beforeBuyer = token.balanceOf(buyer);
            uint256 beforeTreasury = token.balanceOf(TREASURY);
            pool.take(buyer, amounts[i]);
            assertEq(token.balanceOf(TREASURY) - beforeTreasury, fees[i]);
            assertEq(token.balanceOf(buyer) - beforeBuyer, amounts[i] - fees[i]);
        }
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_BuyThenSellConservesSupplyAndSettlesExactly(uint256 amount) public {
        amount = bound(amount, 0, SUPPLY);
        token.transfer(MANAGER, SUPPLY);
        pool.take(buyer, amount);
        uint256 fee = amount * 2 / 100;
        uint256 net = amount - fee;
        assertEq(token.balanceOf(buyer), net);
        assertEq(token.balanceOf(TREASURY), fee);
        assertEq(token.balanceOf(MANAGER), SUPPLY - amount);
        assertEq(token.totalSupply(), SUPPLY);
        vm.prank(buyer);
        token.approve(MANAGER, net);
        pool.settleFrom(buyer, net);
        assertEq(token.balanceOf(buyer), 0);
        assertEq(token.balanceOf(MANAGER) + token.balanceOf(TREASURY), SUPPLY);
        assertEq(token.balanceOf(TREASURY), fee);
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_WalletTransferAndSellAreUntaxed(uint256 amount) public {
        amount = bound(amount, 0, SUPPLY);
        token.transfer(buyer, amount);
        assertEq(token.balanceOf(buyer), amount);
        vm.prank(buyer);
        token.transfer(spender, amount);
        assertEq(token.balanceOf(spender), amount);
        vm.prank(spender);
        token.transfer(MANAGER, amount);
        assertEq(token.balanceOf(MANAGER), amount);
        assertEq(token.balanceOf(TREASURY), 0);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_DelegatedBuyUsesGrossAllowanceAndTaxesFromAddress() public {
        token.transfer(MANAGER, 100e18);
        vm.prank(MANAGER);
        token.approve(spender, 100e18);
        vm.prank(spender);
        assertTrue(token.transferFrom(MANAGER, buyer, 100e18));
        assertEq(token.balanceOf(MANAGER), 0);
        assertEq(token.balanceOf(buyer), 98e18);
        assertEq(token.balanceOf(TREASURY), 2e18);
        assertEq(token.allowance(MANAGER, spender), 0);
    }

    function test_ManagerCallingTransferFromWalletDoesNotCreateABuy() public {
        token.approve(MANAGER, 100e18);
        vm.prank(MANAGER);
        token.transferFrom(address(this), buyer, 100e18);
        assertEq(token.balanceOf(buyer), 100e18);
        assertEq(token.balanceOf(TREASURY), 0);
    }

    function test_InfiniteAllowanceRemainsInfiniteAfterTaxedTransfer() public {
        token.transfer(MANAGER, 100e18);
        vm.prank(MANAGER);
        token.approve(spender, type(uint256).max);
        vm.prank(spender);
        token.transferFrom(MANAGER, buyer, 100e18);
        assertEq(token.allowance(MANAGER, spender), type(uint256).max);
        assertEq(token.balanceOf(buyer), 98e18);
    }

    function test_PoolManagerSelfTransferIsExemptBecauseDestinationIsManager() public {
        token.transfer(MANAGER, 100e18);
        vm.prank(MANAGER);
        token.transfer(MANAGER, 100e18);
        assertEq(token.balanceOf(MANAGER), 100e18);
        assertEq(token.balanceOf(TREASURY), 0);
        vm.prank(MANAGER);
        token.approve(spender, 100e18);
        vm.prank(spender);
        token.transferFrom(MANAGER, MANAGER, 100e18);
        assertEq(token.balanceOf(MANAGER), 100e18);
        assertEq(token.allowance(MANAGER, spender), 0);
    }

    function test_TreasuryAsBuyerReceivesBothSharesWithoutInflatingSupply() public {
        token.transfer(MANAGER, 100e18);
        pool.take(TREASURY, 100e18);
        assertEq(token.balanceOf(TREASURY), 100e18);
        assertEq(token.balanceOf(MANAGER), 0);
        assertEq(token.totalSupply(), SUPPLY);
        vm.prank(TREASURY);
        token.transfer(MANAGER, 100e18);
        assertEq(token.balanceOf(TREASURY), 0);
        assertEq(token.balanceOf(MANAGER), 100e18);
    }

    function test_WalletSelfAndZeroTransfersDoNotChargeTax() public {
        token.transfer(address(this), SUPPLY);
        assertEq(token.balanceOf(address(this)), SUPPLY);
        token.transfer(MANAGER, 0);
        pool.take(buyer, 0);
        vm.prank(buyer);
        token.transfer(spender, 0);
        assertEq(token.balanceOf(TREASURY), 0);
    }

    function test_FailedBuyRollsBackTreasuryBalanceAndAllowance() public {
        token.transfer(MANAGER, 99e18);
        vm.prank(MANAGER);
        token.approve(spender, 100e18);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, MANAGER, 99e18, 100e18));
        vm.prank(spender);
        token.transferFrom(MANAGER, buyer, 100e18);
        assertEq(token.balanceOf(MANAGER), 99e18);
        assertEq(token.balanceOf(buyer), 0);
        assertEq(token.balanceOf(TREASURY), 0);
        assertEq(token.allowance(MANAGER, spender), 100e18);
    }

    function test_InsufficientGrossAllowanceCannotBuy() public {
        token.transfer(MANAGER, 100e18);
        vm.prank(MANAGER);
        token.approve(spender, 98e18);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, spender, 98e18, 100e18)
        );
        vm.prank(spender);
        token.transferFrom(MANAGER, buyer, 100e18);
        assertEq(token.balanceOf(TREASURY), 0);
        assertEq(token.balanceOf(MANAGER), 100e18);
    }

    function test_MaxUintBuyRevertsForBalanceWithoutArithmeticOverflow() public {
        token.transfer(MANAGER, SUPPLY);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, MANAGER, SUPPLY, type(uint256).max)
        );
        vm.prank(MANAGER);
        token.transfer(buyer, type(uint256).max);
        assertEq(token.balanceOf(TREASURY), 0);
    }

    function test_ZeroRecipientCannotBurnOrCollectATax() public {
        token.transfer(MANAGER, 100e18);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        vm.prank(MANAGER);
        token.transfer(address(0), 100e18);
        assertEq(token.balanceOf(TREASURY), 0);
        assertEq(token.balanceOf(MANAGER), 100e18);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_NoAdminMintPauseFreezeOrUpgradeEntryPoints() public {
        token.transfer(buyer, 100e18);
        bytes[] memory calls = new bytes[](15);
        calls[0] = abi.encodeWithSignature("mint(address,uint256)", buyer, SUPPLY);
        calls[1] = abi.encodeWithSignature("mint(uint256)", SUPPLY);
        calls[2] = abi.encodeWithSignature("mint()");
        calls[3] = abi.encodeWithSignature("owner()");
        calls[4] = abi.encodeWithSignature("transferOwnership(address)", spender);
        calls[5] = abi.encodeWithSignature("setTax(uint256)", 0);
        calls[6] = abi.encodeWithSignature("setTreasury(address)", spender);
        calls[7] = abi.encodeWithSignature("setPoolManager(address)", spender);
        calls[8] = abi.encodeWithSignature("pause()");
        calls[9] = abi.encodeWithSignature("blacklist(address)", buyer);
        calls[10] = abi.encodeWithSignature("freeze(address)", buyer);
        calls[11] = abi.encodeWithSignature("burnFrom(address,uint256)", buyer, 100e18);
        calls[12] = abi.encodeWithSignature("upgradeTo(address)", spender);
        calls[13] = abi.encodeWithSignature("initialize(address)", spender);
        calls[14] = abi.encodeWithSignature("seize(address)", buyer);
        for (uint256 i; i < calls.length; ++i) {
            (bool success,) = address(token).call(calls[i]);
            assertFalse(success);
            vm.prank(spender);
            (success,) = address(token).call(calls[i]);
            assertFalse(success);
        }
        vm.expectRevert();
        token.transferFrom(buyer, address(this), 1);
        vm.prank(buyer);
        token.transfer(spender, 100e18);
        assertEq(token.balanceOf(spender), 100e18);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_RuntimeHasNoForbiddenOpcodes() public view {
        bytes memory code = address(token).code;
        assertGt(code.length, 0);
        assertLt(code.length, 24_577);
        for (uint256 i; i < code.length; ++i) {
            uint8 op = uint8(code[i]);
            if (op >= 0x60 && op <= 0x7f) {
                i += op - 0x5f;
            } else {
                assertTrue(op != 0xf4 && op != 0xf2 && op != 0xff);
            }
        }
    }
}
