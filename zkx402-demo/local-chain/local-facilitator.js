import { ethers } from "ethers";

export function createLocalFacilitator(config) {
  const { rpcUrl, usdcAddress, receiverPrivateKey } = config;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const receiverSigner = receiverPrivateKey
    ? new ethers.Wallet(receiverPrivateKey, provider)
    : null;

  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function transferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce,bytes signature)",
  ];

  async function verify(decodedPayment, paymentRequirements) {

    try {
      const { payload } = decodedPayment;
      const { maxAmountRequired, payTo } = paymentRequirements;

      const payer = payload?.authorization?.from;
      const amount = payload?.authorization?.value;
      const validAfter = payload?.authorization?.validAfter;
      const validBefore = payload?.authorization?.validBefore;

      const currentTime = Math.floor(Date.now() / 1000);
      if (validBefore && Number(validBefore) < currentTime) {
        return {
          isValid: false,
          invalidReason: "Payment authorization expired",
          payer,
        };
      }

      if (BigInt(amount) < BigInt(maxAmountRequired)) {
        return {
          isValid: false,
          invalidReason: `Insufficient payment amount. Required: ${maxAmountRequired}, Provided: ${amount}`,
          payer,
        };
      }

      const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, provider);
      const balance = await usdcContract.balanceOf(payer);

      if (balance < BigInt(amount)) {
        return {
          isValid: false,
          invalidReason: `Insufficient balance. Has: ${balance}, Needs: ${amount}`,
          payer,
        };
      }

      if (validAfter && Number(validAfter) > currentTime) {
        return {
          isValid: false,
          invalidReason: "Payment authorization not yet valid",
          payer,
        };
      }

      return {
        isValid: true,
        payer,
        amount,
      };
    } catch (error) {
      console.error("  Verification error:", error);
      return {
        isValid: false,
        invalidReason: error.message,
      };
    }
  }

  async function settle(decodedPayment, paymentRequirements) {
    try {
      const { payTo } = paymentRequirements;
      const { payload } = decodedPayment;

      if (!receiverSigner) {
        return {
          success: false,
          errorReason: "Missing receiverPrivateKey for local settlement",
        };
      }

      const from = payload.authorization.from;
      const to = payload.authorization.to;
      const value = payload.authorization.value;
      const validAfter = payload.authorization.validAfter;
      const validBefore = payload.authorization.validBefore;
      const nonce = payload.authorization.nonce;
      const signature = payload.signature;

      if (to.toLowerCase() !== payTo.toLowerCase()) {
        return {
          success: false,
          errorReason: "Authorization recipient does not match payTo",
        };
      }

      const usdc = new ethers.Contract(usdcAddress, erc20Abi, receiverSigner);
      const tx = await usdc.transferWithAuthorization(
        from,
        payTo,
        value,
        validAfter,
        validBefore,
        nonce,
        signature
      );
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash,
        payer: from,
        amount: value,
        payTo,
      };
    } catch (error) {
      console.error("  Settlement error:", error);
      return {
        success: false,
        errorReason: error.message,
      };
    }
  }

  async function supported() {
    return {
      kinds: [
        {
          scheme: "exact",
          network: "localhost",
          extra: {
            chainId: 31337,
          },
        },
      ],
    };
  }

  return {
    verify,
    settle,
    supported,
  };
}

export const localFacilitator = {
  url: "http://localhost:3001/facilitator",
  createAuthHeaders: async () => ({
    verify: {},
    settle: {},
  }),
};
