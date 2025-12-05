/**
 * Basic usage example for x402-zkx402 middleware
 */

import express from 'express';
import { paymentMiddleware } from 'x402-zkx402';
import { facilitator } from '@coinbase/x402';

const app = express();
const PORT = 3001;

// Your wallet address to receive payments
const RECEIVER_WALLET = '0xYourWalletAddress';

// Apply zkproof-enabled payment middleware
app.use(paymentMiddleware(
  RECEIVER_WALLET,
  {
    // Example 1: Simple endpoint with zkproof discount
    "GET /api/quote": {
      price: "$0.01",
      network: "base-sepolia",
      config: {
        description: "Get a motivational quote",
        extra: {
          // Users with "human" proof get 50% discount
          variableAmountRequired: [
            {
              requestedProofs: "zkproofOf(human)",
              amountRequired: "5000" // 0.005 USDC
            }
          ]
        }
      }
    },

    // Example 2: Premium content with multiple proof requirements
    "GET /api/premium": {
      price: "$0.10",
      network: "base-sepolia",
      config: {
        description: "Premium verified content",
        extra: {
          // Verified journalists get significant discount
          variableAmountRequired: [
            {
              requestedProofs: "zkproofOf(human), zkproofOf(institution=NYT)",
              amountRequired: "10000" // 0.01 USDC (90% off)
            },
            {
              // Just human verification gets smaller discount
              requestedProofs: "zkproofOf(human)",
              amountRequired: "50000" // 0.05 USDC (50% off)
            }
          ],
          // Content has provenance proof
          contentMetadata: [
            { proof: "zkproof(verified-source)" },
            { proof: "zkproof(timestamp-2024)" }
          ]
        }
      }
    }
  },
  facilitator // Use CDP's hosted facilitator
));

// Protected endpoint handler
app.get("/api/quote", (req, res) => {
  // Access verification metadata set by middleware
  const verification = req.verificationMetadata;
  
  res.json({
    quote: "Innovation is doing new things. --Peter Drucker",
    paid: true,
    verification: verification ? {
      qualified: verification.qualified,
      discountApplied: verification.discountApplied,
      discountedPrice: verification.discountedPrice,
    } : null
  });
});

app.get("/api/premium", (req, res) => {
  const verification = req.verificationMetadata;
  
  res.json({
    content: "Premium verified content from whistleblower...",
    paid: true,
    proofs: req.verificationMetadata?.verificationResult?.verificationDetails
  });
});

// Health check endpoint (no payment required)
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Receiving payments at: ${RECEIVER_WALLET}`);
});

/**
 * Client-side usage:
 * 
 * // Include zkproofs in request headers
 * const response = await fetch('http://localhost:3001/api/quote', {
 *   headers: {
 *     'X-User-Proofs': JSON.stringify(['zkproofOf(human)'])
 *   }
 * });
 * 
 * // First request returns 402 with discounted price
 * // Client handles payment and retries with X-PAYMENT header
 */

