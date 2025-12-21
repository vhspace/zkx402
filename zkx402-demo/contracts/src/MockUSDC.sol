// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for local testing
 * Mints 1M USDC to deployer on construction
 */
contract MockUSDC is ERC20, EIP712 {
    uint8 private _decimals = 6; // USDC uses 6 decimals

    mapping(bytes32 => bool) public authorizationState;

    bytes32 private constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256(
            "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
        );

    constructor() ERC20("Mock USDC", "USDC") EIP712("USDC", "2") {
        // Mint 1M USDC to deployer for testing
        _mint(msg.sender, 1_000_000 * 10 ** _decimals);
    }

    /**
     * @dev Returns 6 decimals to match real USDC
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint function for testing - anyone can mint
     * @param to Address to mint tokens to
     * @param amount Amount to mint (in atomic units, 6 decimals)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        require(block.timestamp > validAfter, "AUTH_NOT_YET_VALID");
        require(block.timestamp < validBefore, "AUTH_EXPIRED");
        require(!authorizationState[nonce], "AUTH_ALREADY_USED");

        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == from, "INVALID_SIGNATURE");

        authorizationState[nonce] = true;
        _transfer(from, to, value);
    }

    /**
     * @dev Faucet function - gives 100 USDC to caller
     */
    function faucet() external {
        _mint(msg.sender, 100 * 10 ** _decimals);
    }
}




