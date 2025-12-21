// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockHumanRegistry {
    mapping(address => bool) public verified;

    constructor(address initialVerified) {
        verified[initialVerified] = true;
    }

    function isVerified(address userAddress) external view returns (bool) {
        return verified[userAddress];
    }

    function setVerified(address userAddress, bool value) external {
        verified[userAddress] = value;
    }
}


