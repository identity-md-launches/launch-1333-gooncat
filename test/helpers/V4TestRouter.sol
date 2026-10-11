// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "../vendor/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "../vendor/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "../vendor/v4-core/src/types/PoolKey.sol";
import {Currency} from "../vendor/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "../vendor/v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "../vendor/v4-core/src/libraries/TickMath.sol";

/// @dev Only the pair currency is mocked. The token under test and v4 core are real contracts.
contract IMDTestCurrency is ERC20 {
    constructor() ERC20("Local IMD", "IMD") {}

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }
}

/// @dev Test-only unlock callback. Moves ERC20s using approvals from the actual payer,
/// and takes output directly to the recipient. A deliberate short payment lets tests
/// prove that v4's final solvency check rolls back GOONCAT taxes as well as pool state.
contract V4TestRouter is IUnlockCallback {
    error OnlyPoolManager();
    error NetOutputTooLow(uint256 actual, uint256 minimum);

    enum Operation {
        Liquidity,
        Swap
    }

    struct Request {
        Operation operation;
        address payer;
        address recipient;
        bool zeroForOne;
        int256 amount;
        uint256 minimumOutput;
        uint256 shortPayment;
    }

    IPoolManager public immutable manager;
    PoolKey private key;
    int24 public immutable tickLower;
    int24 public immutable tickUpper;

    constructor(IPoolManager manager_, PoolKey memory key_, int24 lower, int24 upper) {
        manager = manager_;
        key = key_;
        tickLower = lower;
        tickUpper = upper;
    }

    function modifyLiquidity(int256 amount) external returns (BalanceDelta delta, BalanceDelta fees) {
        return abi.decode(
            manager.unlock(abi.encode(Request(Operation.Liquidity, msg.sender, msg.sender, false, amount, 0, 0))),
            (BalanceDelta, BalanceDelta)
        );
    }

    function swap(bool zeroForOne, int256 amount, address recipient, uint256 minimum, uint256 shortPayment)
        external
        returns (BalanceDelta delta)
    {
        (delta,) = abi.decode(
            manager.unlock(
                abi.encode(Request(Operation.Swap, msg.sender, recipient, zeroForOne, amount, minimum, shortPayment))
            ),
            (BalanceDelta, BalanceDelta)
        );
    }

    function forward(IERC20 token, address recipient, uint256 amount) external {
        require(token.transfer(recipient, amount), "forward failed");
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(manager)) revert OnlyPoolManager();
        Request memory request = abi.decode(data, (Request));
        BalanceDelta delta;
        BalanceDelta fees;
        Currency output = request.zeroForOne ? key.currency1 : key.currency0;
        uint256 beforeOutput = IERC20(Currency.unwrap(output)).balanceOf(request.recipient);

        if (request.operation == Operation.Swap) {
            delta = manager.swap(
                key,
                IPoolManager.SwapParams({
                    zeroForOne: request.zeroForOne,
                    amountSpecified: request.amount,
                    sqrtPriceLimitX96: request.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
                }),
                ""
            );
        } else {
            (delta, fees) = manager.modifyLiquidity(
                key,
                IPoolManager.ModifyLiquidityParams({
                    tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: request.amount, salt: bytes32(0)
                }),
                ""
            );
        }

        _settle(key.currency0, delta.amount0(), request);
        _settle(key.currency1, delta.amount1(), request);
        if (request.operation == Operation.Swap) {
            uint256 received = IERC20(Currency.unwrap(output)).balanceOf(request.recipient) - beforeOutput;
            if (received < request.minimumOutput) revert NetOutputTooLow(received, request.minimumOutput);
        }
        return abi.encode(delta, fees);
    }

    function _settle(Currency currency, int128 delta, Request memory request) private {
        if (delta < 0) {
            uint256 payment = uint256(-int256(delta)) - request.shortPayment;
            manager.sync(currency);
            require(
                IERC20(Currency.unwrap(currency)).transferFrom(request.payer, address(manager), payment), "pay failed"
            );
            require(manager.settle() == payment, "settlement amount mismatch");
        } else if (delta > 0) {
            manager.take(currency, request.recipient, uint256(int256(delta)));
        }
    }
}
