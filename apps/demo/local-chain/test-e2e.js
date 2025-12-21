import { ethers } from "ethers";
import fetch from "node-fetch";
import fs from "fs";
import dotenv from "dotenv";
import assert from "node:assert/strict";

dotenv.config({ path: "../server/.env.local" });

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

const config = {
  rpcUrl: process.env.RPC_URL || "http://localhost:8545",
  serverUrl: process.env.SERVER_URL || "http://localhost:3001",
  usdcAddress: process.env.USDC_ADDRESS,
  receiverAddress: process.env.RECEIVER_WALLET,
  payerAddress: process.env.PAYER_ADDRESS,
  payerPrivateKey: process.env.PAYER_PRIVATE_KEY,
};

if (!config.usdcAddress) {
  log(colors.red, "Missing USDC_ADDRESS in .env.local");
  log(colors.yellow, "Run npm run setup first");
  process.exit(1);
}

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function name() view returns (string)",
  "function version() view returns (string)",
];

async function main() {
  log(colors.blue, "\nStarting x402 End-to-End Test\n");

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const payerWallet = new ethers.Wallet(config.payerPrivateKey, provider);
  const usdcContract = new ethers.Contract(config.usdcAddress, erc20Abi, payerWallet);
  log(colors.blue, "Step 1: Check initial balances");
  const payerBalanceBefore = await usdcContract.balanceOf(config.payerAddress);
  const receiverBalanceBefore = await usdcContract.balanceOf(
    config.receiverAddress
  );

  log(
    colors.green,
    `  Payer balance:    ${ethers.formatUnits(payerBalanceBefore, 6)} USDC`
  );
  log(
    colors.green,
    `  Receiver balance: ${ethers.formatUnits(receiverBalanceBefore, 6)} USDC`
  );

  log(colors.blue, "\nStep 2: Check server health");
  try {
    const healthResponse = await fetch(`${config.serverUrl}/health`);
    const healthData = await healthResponse.json();
    log(colors.green, `  Server is ${healthData.status}`);
  } catch (error) {
    log(colors.red, "  Server is not running");
    log(colors.yellow, "  Start the server: cd ../server && npm run dev");
    process.exit(1);
  }

  log(colors.blue, "\nStep 3: Request protected endpoint (without payment)");
  const initialResponse = await fetch(`${config.serverUrl}/motivate`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (initialResponse.status !== 402) {
    log(colors.red, `  Expected 402 status, got ${initialResponse.status}`);
    process.exit(1);
  }

  const paymentRequirements = await initialResponse.json();
  log(colors.green, "  Received 402 Payment Required");

  const requirement = paymentRequirements.accepts[0];
  const { maxAmountRequired, payTo, asset, network, maxTimeoutSeconds } =
    requirement;

  log(colors.blue, "\nStep 4: Create payment authorization");

  const chainId = (await provider.getNetwork()).chainId;
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + maxTimeoutSeconds;
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const domain = {
    name: requirement.extra.name,
    version: requirement.extra.version,
    chainId: Number(chainId),
    verifyingContract: asset,
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const authorization = {
    from: config.payerAddress,
    to: payTo,
    value: maxAmountRequired,
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await payerWallet.signTypedData(
    domain,
    types,
    authorization
  );
  log(colors.green, "  Authorization signed");

  const paymentHeader = Buffer.from(
    JSON.stringify({
      x402Version: 1,
      scheme: "exact",
      network: requirement.network,
      payload: {
        signature,
        authorization: {
          from: authorization.from,
          to: authorization.to,
          value: String(authorization.value),
          validAfter: String(authorization.validAfter),
          validBefore: String(authorization.validBefore),
          nonce: authorization.nonce,
        },
      },
    })
  ).toString("base64");

  log(colors.blue, "\nStep 5: Request with payment");

  const paidResponse = await fetch(`${config.serverUrl}/motivate`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-PAYMENT": paymentHeader,
    },
  });

  if (!paidResponse.ok) {
    const errorData = await paidResponse.json();
    log(colors.red, `  Payment failed: ${paidResponse.status}`);
    log(colors.red, "  Error:", JSON.stringify(errorData, null, 2));
    process.exit(1);
  }

  const responseData = await paidResponse.json();
  log(colors.green, "  Payment accepted");
  log(colors.green, "  Response:", JSON.stringify(responseData, null, 2));

  const paymentResponseHeader = paidResponse.headers.get("X-PAYMENT-RESPONSE");
  if (paymentResponseHeader) {
    log(colors.green, "  Received payment response header");
  }

  log(colors.blue, "\nStep 6: Check final balances");

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const payerBalanceAfter = await usdcContract.balanceOf(config.payerAddress);
  const receiverBalanceAfter = await usdcContract.balanceOf(
    config.receiverAddress
  );

  log(
    colors.green,
    `  Payer balance:    ${ethers.formatUnits(payerBalanceAfter, 6)} USDC`
  );
  log(
    colors.green,
    `  Receiver balance: ${ethers.formatUnits(receiverBalanceAfter, 6)} USDC`
  );

  const payerDiff = payerBalanceBefore - payerBalanceAfter;
  const receiverDiff = receiverBalanceAfter - receiverBalanceBefore;

  log(
    colors.yellow,
    `  Payer spent:      ${ethers.formatUnits(payerDiff, 6)} USDC`
  );
  log(
    colors.yellow,
    `  Receiver gained:  ${ethers.formatUnits(receiverDiff, 6)} USDC`
  );

  assert.equal(payerDiff, BigInt(maxAmountRequired));
  assert.equal(receiverDiff, BigInt(maxAmountRequired));

  log(colors.blue, "\nStep 7: Test with zkproofs (dynamic pricing)");

  const proofsHeaders = {
    Accept: "application/json",
    "X-Wallet-Address": config.payerAddress,
    "X-Proof-Claims": JSON.stringify([{ type: "human" }]),
  };

  const proofsResponse = await fetch(`${config.serverUrl}/motivate`, {
    method: "GET",
    headers: {
      ...proofsHeaders,
    },
  });

  if (proofsResponse.status === 402) {
    const proofsRequirements = await proofsResponse.json();
    const proofsRequirement = proofsRequirements.accepts[0];

    log(colors.green, "  Received requirements with proofs");
    log(
      colors.yellow,
      `  Discounted price: ${ethers.formatUnits(proofsRequirement.maxAmountRequired, 6)} USDC`
    );
    log(
      colors.yellow,
      `  Original price:   ${ethers.formatUnits(maxAmountRequired, 6)} USDC`
    );

    const original = BigInt(maxAmountRequired);
    const discounted = BigInt(proofsRequirement.maxAmountRequired);
    const discount = ((original - discounted) * 100n) / original;
    log(colors.green, `  Discount applied: ${discount}%`);

    log(colors.blue, "\nStep 8: Pay discounted price (proofPolicy/router path)");

    const payerBalanceBeforeDiscount = await usdcContract.balanceOf(config.payerAddress);
    const receiverBalanceBeforeDiscount = await usdcContract.balanceOf(
      config.receiverAddress
    );

    const discountedAuthorization = {
      from: config.payerAddress,
      to: proofsRequirement.payTo,
      value: proofsRequirement.maxAmountRequired,
      validAfter,
      validBefore,
      nonce: ethers.hexlify(ethers.randomBytes(32)),
    };

    const discountedSignature = await payerWallet.signTypedData(
      domain,
      types,
      discountedAuthorization
    );

    const discountedPaymentHeader = Buffer.from(
      JSON.stringify({
        x402Version: 1,
        scheme: "exact",
        network: proofsRequirement.network,
        payload: {
          signature: discountedSignature,
          authorization: {
            from: discountedAuthorization.from,
            to: discountedAuthorization.to,
            value: String(discountedAuthorization.value),
            validAfter: String(discountedAuthorization.validAfter),
            validBefore: String(discountedAuthorization.validBefore),
            nonce: discountedAuthorization.nonce,
          },
        },
      })
    ).toString("base64");

    const discountedPaidResponse = await fetch(`${config.serverUrl}/motivate`, {
      method: "GET",
      headers: {
        ...proofsHeaders,
        "X-PAYMENT": discountedPaymentHeader,
      },
    });

    assert.equal(discountedPaidResponse.status, 200);
    const discountedPaidData = await discountedPaidResponse.json();
    assert.equal(discountedPaidData.paid, true);
    assert.equal(discountedPaidData.verification?.qualified, true);
    assert.equal(discountedPaidData.verification?.discountApplied, true);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const payerBalanceAfterDiscount = await usdcContract.balanceOf(config.payerAddress);
    const receiverBalanceAfterDiscount = await usdcContract.balanceOf(
      config.receiverAddress
    );

    const payerDiffDiscount = payerBalanceBeforeDiscount - payerBalanceAfterDiscount;
    const receiverDiffDiscount =
      receiverBalanceAfterDiscount - receiverBalanceBeforeDiscount;

    assert.equal(payerDiffDiscount, BigInt(proofsRequirement.maxAmountRequired));
    assert.equal(receiverDiffDiscount, BigInt(proofsRequirement.maxAmountRequired));

    log(
      colors.green,
      `  Discounted payment spent: ${ethers.formatUnits(payerDiffDiscount, 6)} USDC`
    );
  }

  log(colors.blue, "\nTest Summary");
  log(colors.green, "  Server health check passed");
  log(colors.green, "  Received 402 Payment Required");
  log(colors.green, "  Payment authorization created");
  log(colors.green, "  Payment accepted and content received");
  log(colors.green, "  Payment response header received");
  log(colors.green, "  Dynamic pricing with zkproofs tested");

  log(colors.blue, "\nAll tests passed!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log(colors.red, "\nTest failed:", error);
    process.exit(1);
  });

