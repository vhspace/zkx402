// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title VlayerProofRegistry
 * @notice Minimal on-chain registry for "vlayer proof recorded" attestations.
 *
 * This is intentionally simple for demo/testing:
 * - keyed by (subject wallet, claimHash)
 * - mutable via setVerified (in production you'd gate this behind an attestor role or
 *   require a proof verification flow).
 */
contract VlayerProofRegistry {
    mapping(address => mapping(bytes32 => bool)) public verified;

    function isVerified(address subject, bytes32 claimHash) external view returns (bool) {
        return verified[subject][claimHash];
    }

    function setVerified(address subject, bytes32 claimHash, bool value) external {
        verified[subject][claimHash] = value;
    }
}

