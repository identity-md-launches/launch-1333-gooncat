// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {GOONCATToken} from "src/GOONCATToken.sol";
import {IMDTestCurrency, V4TestRouter} from "./helpers/V4TestRouter.sol";
import {PoolManager} from "./vendor/v4-core/src/PoolManager.sol";
import {IPoolManager} from "./vendor/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "./vendor/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "./vendor/v4-core/src/types/PoolKey.sol";
import {Currency} from "./vendor/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "./vendor/v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "./vendor/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "./vendor/v4-core/src/libraries/FullMath.sol";
import {StateLibrary} from "./vendor/v4-core/src/libraries/StateLibrary.sol";
import {TransientStateLibrary} from "./vendor/v4-core/src/libraries/TransientStateLibrary.sol";

/// @dev A local v4.0.0 PoolManager, constructed at the canonical address, exercises
/// real swap math, LP fees, sync/settle/take and transient accounting. No RPC or fork.
/// The two concrete suites cover both deployed currency orders against fixed IMD.
abstract contract GOONCATPoolManagerTestBase is Test {
    using StateLibrary for IPoolManager;
    using TransientStateLibrary for IPoolManager;

    uint256 internal constant SUPPLY = 1_000_000_000e18;
    uint256 internal constant CAP = 2500e18;
    uint256 internal constant Q96 = 1 << 96;
    address internal constant MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;
    address internal constant TREASURY = 0xFec44feFbC7B83Ce9Be3A36d647D36f45CFF59E2;
    address internal constant IMD = address(bytes20(hex"d34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7"));
    address internal constant REMAINDER = address(0xdead);

    GOONCATToken internal token;
    IMDTestCurrency internal pair;
    IPoolManager internal manager;
    V4TestRouter internal router;
    PoolKey internal key;
    address internal trader;
    address internal distributor;
    address internal claimant;
    bool internal tokenIs0;
    uint256 internal seeded;
    uint256 internal remainder;
    uint128 internal liquidity;
    uint160 internal openingPrice;

    function _setUp(bool asCurrency0) internal {
        vm.chainId(1);
        tokenIs0 = asCurrency0;
        trader = makeAddr("v4 trader");
        distributor = makeAddr("swarm distributor");
        claimant = makeAddr("swarm claimant");

        // Running creation code at this address preserves NoDelegateCall's immutable
        // original address. Copying runtime from another address would disable swaps.
        _constructAt(MANAGER, abi.encodePacked(type(PoolManager).creationCode, abi.encode(address(this))));
        manager = IPoolManager(MANAGER);
        _constructAt(IMD, type(IMDTestCurrency).creationCode);
        pair = IMDTestCurrency(IMD);
        token = _deployInOrder(asCurrency0);
        assertEq(token.totalSupply(), SUPPLY);
        assertEq(token.balanceOf(address(this)), SUPPLY, "constructor must mint the whole supply");
        assertEq(token.balanceOf(TREASURY), 0);
        assertEq(token.balanceOf(MANAGER), 0);

        key = PoolKey({
            currency0: Currency.wrap(asCurrency0 ? address(token) : IMD),
            currency1: Currency.wrap(asCurrency0 ? IMD : address(token)),
            fee: 12_500,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        // Derive sqrt(currency1 / currency0) from the 2500 IMD opening cap and
        // full supply. The manifest's provenance price assumes GOONCAT is currency0.
        openingPrice = uint160(_sqrt(FullMath.mulDiv(asCurrency0 ? CAP : SUPPLY, 1 << 192, asCurrency0 ? SUPPLY : CAP)));
        if (asCurrency0) assertEq(openingPrice, 125270724187523965593206900);
        int24 tick = manager.initialize(key, openingPrice);
        int24 floorTick = (tick < 0 ? (tick - 59) / 60 : tick / 60) * 60;
        int24 lower = asCurrency0 ? floorTick + 60 : floorTick - 12_000;
        int24 upper = asCurrency0 ? lower + 12_000 : floorTick;
        router = new V4TestRouter(manager, key, lower, upper);

        token.transfer(distributor, SUPPLY / 10);
        uint256 poolBudget = SUPPLY * 9000 / 10_000;
        uint160 a = TickMath.getSqrtPriceAtTick(lower);
        uint160 b = TickMath.getSqrtPriceAtTick(upper);
        uint256 calculated = asCurrency0
            ? FullMath.mulDiv(poolBudget, FullMath.mulDiv(a, b, Q96), b - a)
            : FullMath.mulDiv(poolBudget, Q96, b - a);
        assertLe(calculated, type(uint128).max);
        liquidity = uint128(calculated);
        token.approve(address(router), poolBudget);
        (BalanceDelta delta,) = router.modifyLiquidity(int256(uint256(liquidity)));
        seeded = uint256(-int256(_tokenDelta(delta)));
        assertGt(seeded, 0);
        assertLe(seeded, poolBudget);
        assertEq(_pairDelta(delta), 0, "launch must be single-sided");
        assertEq(token.balanceOf(MANAGER), seeded, "seed must settle without a token tax");
        remainder = token.balanceOf(address(this));
        assertLt(remainder, 1e18, "only liquidity rounding dust should remain");
        token.transfer(REMAINDER, remainder);

        pair.mint(trader, 1000e18);
        vm.startPrank(trader);
        pair.approve(address(router), type(uint256).max);
        token.approve(address(router), type(uint256).max);
        vm.stopPrank();
        _assertSettled();
    }

    function test_LaunchAllocationAndSwarmClaimArriveWhole() public {
        assertEq(token.balanceOf(distributor), SUPPLY / 10);
        assertEq(seeded + remainder, SUPPLY * 9 / 10);
        assertEq(token.balanceOf(address(this)), 0);
        assertEq(token.balanceOf(TREASURY), 0, "no internal swarm or protocol-fee deduction");
        vm.prank(distributor);
        assertTrue(token.transfer(claimant, SUPPLY / 10));
        assertEq(token.balanceOf(claimant), SUPPLY / 10);
        assertEq(token.balanceOf(distributor), 0);
        assertEq(token.balanceOf(MANAGER), seeded);
        assertEq(token.balanceOf(TREASURY), 0);
        _assertSettled();
    }

    function test_RealBuySellAndCollectionOfBothLPFees() public {
        (uint256 bought, uint256 creatorFee) = _buyAndCheck(10e18, trader);
        (uint256 fee0, uint256 fee1) = manager.getFeeGrowthGlobals(key.toId());
        assertGt(tokenIs0 ? fee1 : fee0, 0, "buy must accrue IMD LP fees");
        assertEq(tokenIs0 ? fee0 : fee1, 0);

        uint256 pairBefore = pair.balanceOf(trader);
        uint256 poolBefore = token.balanceOf(MANAGER);
        vm.prank(trader);
        BalanceDelta sale = router.swap(tokenIs0, -int256(bought), trader, 1, 0);
        uint256 returnedIMD = uint256(int256(_pairDelta(sale)));
        assertEq(_tokenDelta(sale), -int256(bought));
        assertEq(token.balanceOf(MANAGER), poolBefore + bought, "sell must settle gross input");
        assertEq(token.balanceOf(trader), 0);
        assertEq(token.balanceOf(TREASURY), creatorFee, "sell cannot charge creator tax");
        assertEq(pair.balanceOf(trader), pairBefore + returnedIMD);
        assertGt(returnedIMD, 0);
        assertLt(returnedIMD, 10e18, "round trip pays LP fees and creator tax");
        (fee0, fee1) = manager.getFeeGrowthGlobals(key.toId());
        assertGt(fee0, 0);
        assertGt(fee1, 0);

        poolBefore = token.balanceOf(MANAGER);
        uint256 pairPoolBefore = pair.balanceOf(MANAGER);
        (BalanceDelta collected, BalanceDelta fees) = router.modifyLiquidity(0);
        assertEq(BalanceDelta.unwrap(collected), BalanceDelta.unwrap(fees));
        uint256 grossTokenFee = uint256(int256(_tokenDelta(fees)));
        uint256 pairFee = uint256(int256(_pairDelta(fees)));
        assertGt(grossTokenFee, 0);
        assertGt(pairFee, 0);
        // M1 defines buys by FROM PoolManager, so taking GOONCAT LP fees is taxed too.
        assertEq(token.balanceOf(address(this)), grossTokenFee - grossTokenFee * 2 / 100);
        assertEq(token.balanceOf(TREASURY), creatorFee + grossTokenFee * 2 / 100);
        assertEq(token.balanceOf(MANAGER), poolBefore - grossTokenFee);
        assertEq(pair.balanceOf(address(this)), pairFee);
        assertEq(pair.balanceOf(MANAGER), pairPoolBefore - pairFee);
        assertEq(manager.protocolFeesAccrued(key.currency0), 0, "platform fee is external to this token/pool");
        assertEq(manager.protocolFeesAccrued(key.currency1), 0);
        _assertSettled();
    }

    function test_ExactOutputBuyAndSellUseGrossPoolDeltas() public {
        uint256 gross = 100_000e18;
        vm.prank(trader);
        BalanceDelta buy = router.swap(!tokenIs0, int256(gross), trader, gross * 98 / 100, 0);
        assertEq(_tokenDelta(buy), int256(gross));
        assertEq(token.balanceOf(trader), gross * 98 / 100);
        assertEq(token.balanceOf(TREASURY), gross * 2 / 100);
        assertEq(token.balanceOf(MANAGER), seeded - gross);
        uint256 beforeTokens = token.balanceOf(trader);
        uint256 beforePair = pair.balanceOf(trader);
        vm.prank(trader);
        BalanceDelta sale = router.swap(tokenIs0, 0.001e18, trader, 0.001e18, 0);
        assertEq(_pairDelta(sale), 0.001e18);
        uint256 sold = uint256(-int256(_tokenDelta(sale)));
        assertGt(sold, 0);
        assertEq(token.balanceOf(trader), beforeTokens - sold);
        assertEq(token.balanceOf(MANAGER), seeded - gross + sold);
        assertEq(pair.balanceOf(trader), beforePair + 0.001e18);
        assertEq(token.balanceOf(TREASURY), gross * 2 / 100);
        _assertSettled();
    }

    function test_RouterForwardingDoesNotChargeASecondTax() public {
        (uint256 net, uint256 fee) = _buyAndCheck(1e18, address(router));
        router.forward(token, trader, net);
        assertEq(token.balanceOf(trader), net);
        assertEq(token.balanceOf(address(router)), 0);
        assertEq(token.balanceOf(TREASURY), fee);
        _assertSettled();
    }

    function test_TreasuryCanBuyAndReceivesBothShares() public {
        uint256 poolBefore = token.balanceOf(MANAGER);
        vm.prank(trader);
        BalanceDelta buy = router.swap(!tokenIs0, -1e18, TREASURY, 1, 0);
        uint256 gross = uint256(int256(_tokenDelta(buy)));
        assertGt(gross, 0);
        assertEq(token.balanceOf(TREASURY), gross);
        assertEq(token.balanceOf(MANAGER), poolBefore - gross);
        _assertSettled();
    }

    function test_UnpaidOneWeiRevertsSwapTaxAllowanceAndPoolState() public {
        // A finite allowance makes allowance rollback observable as well.
        vm.prank(trader);
        pair.approve(address(router), 10e18);
        bytes32 beforeState = _stateDigest();
        vm.expectRevert(IPoolManager.CurrencyNotSettled.selector);
        vm.prank(trader);
        router.swap(!tokenIs0, -10e18, trader, 1, 1);
        assertEq(_stateDigest(), beforeState, "failed settlement must be atomic");
        assertEq(pair.allowance(trader, address(router)), 10e18);
        _assertSettled();
        _buyAndCheck(10e18, trader); // The failed unlock must not prevent a retry.
    }

    function test_InsufficientSellApprovalRevertsWithoutMovingValue() public {
        (uint256 net,) = _buyAndCheck(1e18, trader);
        vm.prank(trader);
        token.approve(address(router), net - 1);
        bytes32 beforeState = _stateDigest();
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(router), net - 1, net)
        );
        vm.prank(trader);
        router.swap(tokenIs0, -int256(net), trader, 1, 0);
        assertEq(_stateDigest(), beforeState);
        assertEq(token.allowance(trader, address(router)), net - 1);
        _assertSettled();
    }

    function test_MinimumOutputChecksBuyerBalanceAfterCreatorTax() public {
        uint256 gross = 100_000e18;
        bytes32 beforeState = _stateDigest();
        vm.expectRevert(abi.encodeWithSelector(V4TestRouter.NetOutputTooLow.selector, gross * 98 / 100, gross));
        vm.prank(trader);
        router.swap(!tokenIs0, int256(gross), trader, gross, 0);
        assertEq(_stateDigest(), beforeState, "slippage rejection must undo the treasury credit");
        _assertSettled();
    }

    function test_Static12500PoolFeeCannotBeChanged() public {
        vm.expectRevert(IPoolManager.UnauthorizedDynamicLPFeeUpdate.selector);
        manager.updateDynamicLPFee(key, 0);
        _buyAndCheck(1e18, trader);
        (,,, uint24 lpFee) = manager.getSlot0(key.toId());
        assertEq(lpFee, 12_500);
    }

    function testFuzz_RealSwapsSettleGrossAndConserveSupply(uint256 input) public {
        input = bound(input, 1e12, 100e18);
        (uint256 net, uint256 fee) = _buyAndCheck(input, trader);
        vm.prank(trader);
        BalanceDelta sale = router.swap(tokenIs0, -int256(net), trader, 0, 0);
        assertEq(_tokenDelta(sale), -int256(net));
        assertEq(token.balanceOf(trader), 0);
        assertEq(token.balanceOf(MANAGER), seeded - fee);
        assertEq(token.balanceOf(TREASURY), fee);
        assertEq(
            token.balanceOf(MANAGER) + token.balanceOf(TREASURY) + token.balanceOf(distributor)
                + token.balanceOf(REMAINDER),
            SUPPLY
        );
        _assertSettled();
    }

    function _buyAndCheck(uint256 input, address recipient) internal returns (uint256 net, uint256 fee) {
        uint256 beforePool = token.balanceOf(MANAGER);
        uint256 beforeRecipient = token.balanceOf(recipient);
        uint256 beforeTreasury = token.balanceOf(TREASURY);
        uint256 beforePair = pair.balanceOf(trader);
        uint256 beforePairPool = pair.balanceOf(MANAGER);
        vm.prank(trader);
        BalanceDelta delta = router.swap(!tokenIs0, -int256(input), recipient, 1, 0);
        uint256 gross = uint256(int256(_tokenDelta(delta)));
        assertGt(gross, 0);
        fee = gross * 2 / 100;
        net = gross - fee;
        assertEq(_pairDelta(delta), -int256(input));
        assertEq(pair.balanceOf(trader), beforePair - input);
        assertEq(pair.balanceOf(MANAGER), beforePairPool + input);
        assertEq(token.balanceOf(MANAGER), beforePool - gross);
        assertEq(token.balanceOf(recipient), beforeRecipient + net);
        assertEq(token.balanceOf(TREASURY), beforeTreasury + fee);
        _assertSettled();
    }

    function _assertSettled() internal view {
        assertFalse(manager.isUnlocked());
        assertEq(manager.getNonzeroDeltaCount(), 0);
        assertEq(manager.currencyDelta(address(router), key.currency0), 0);
        assertEq(manager.currencyDelta(address(router), key.currency1), 0);
        assertEq(token.totalSupply(), SUPPLY);
        (,,, uint24 lpFee) = manager.getSlot0(key.toId());
        assertEq(lpFee, 12_500);
    }

    function _stateDigest() internal view returns (bytes32) {
        (uint160 price, int24 tick, uint24 protocolFee, uint24 lpFee) = manager.getSlot0(key.toId());
        (uint256 fee0, uint256 fee1) = manager.getFeeGrowthGlobals(key.toId());
        bytes32 poolState =
            keccak256(abi.encode(price, tick, protocolFee, lpFee, fee0, fee1, manager.getLiquidity(key.toId())));
        return keccak256(
            abi.encode(
                poolState,
                token.balanceOf(MANAGER),
                token.balanceOf(trader),
                token.balanceOf(TREASURY),
                pair.balanceOf(MANAGER),
                pair.balanceOf(trader),
                token.totalSupply()
            )
        );
    }

    function _tokenDelta(BalanceDelta delta) internal view returns (int128) {
        return tokenIs0 ? delta.amount0() : delta.amount1();
    }

    function _pairDelta(BalanceDelta delta) internal view returns (int128) {
        return tokenIs0 ? delta.amount1() : delta.amount0();
    }

    function _constructAt(address at, bytes memory initCode) internal {
        vm.etch(at, initCode);
        (bool success, bytes memory runtime) = at.call("");
        assertTrue(success, "in-place constructor failed");
        assertGt(runtime.length, 0);
        vm.etch(at, runtime);
    }

    function _deployInOrder(bool asCurrency0) internal returns (GOONCATToken deployed) {
        bytes32 hash = keccak256(type(GOONCATToken).creationCode);
        for (uint256 salt; salt < 256; ++salt) {
            address predicted = vm.computeCreate2Address(bytes32(salt), hash, address(this));
            if ((predicted < IMD) == asCurrency0 && predicted != IMD) {
                deployed = new GOONCATToken{salt: bytes32(salt)}();
                assertEq(address(deployed), predicted);
                return deployed;
            }
        }
        revert("could not find test deployment currency order");
    }

    function _sqrt(uint256 x) internal pure returns (uint256 result) {
        result = x;
        uint256 next = (x + 1) / 2;
        while (next < result) {
            result = next;
            next = (x / next + next) / 2;
        }
    }
}

contract GOONCATCurrency0PoolManagerTest is GOONCATPoolManagerTestBase {
    function setUp() public {
        _setUp(true);
    }
}

contract GOONCATCurrency1PoolManagerTest is GOONCATPoolManagerTestBase {
    function setUp() public {
        _setUp(false);
    }
}
