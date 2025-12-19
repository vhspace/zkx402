// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/**
 * @title DeployMockUSDC
 * @dev Script to deploy MockUSDC for local testing
 * 
 * Usage:
 *   # Deploy to local Anvil chain
 *   forge script script/DeployMockUSDC.s.sol:DeployMockUSDC --rpc-url http://localhost:8545 --broadcast
 */
contract DeployMockUSDC is Script {
    function run() external returns (MockUSDC usdc) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy MockUSDC
        usdc = new MockUSDC();
        
        console.log("=================================");
        console.log("MockUSDC deployed at:", address(usdc));
        console.log("Deployer:", msg.sender);
        console.log("Initial balance:", usdc.balanceOf(msg.sender));
        console.log("=================================");
        
        vm.stopBroadcast();
        
        return usdc;
    }
}




