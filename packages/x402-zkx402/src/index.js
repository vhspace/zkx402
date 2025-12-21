/**
 * x402-zkx402: Zero-knowledge proof verification middleware for x402 protocol
 *
 * This package extends the x402 payment protocol with zkproof verification,
 * enabling identity-based variable pricing and content provenance verification.
 *
 * @example
 * ```javascript
 * import { paymentMiddleware } from 'x402-zkx402';
 * import { facilitator } from '@coinbase/x402';
 *
 * app.use(paymentMiddleware(
 *   '0xYourWallet',
 *   {
 *     "GET /api/data": {
 *       price: "$0.01",
 *       network: "base-sepolia",
 *       config: {
 *         description: "Access to verified data",
 *         extra: {
 *           proofPolicy: {
 *             version: 1,
 *             scope: "zkx402",
 *             claims: [{ type: "human" }],
 *             allowedProviders: ["self"],
 *             preferenceOrder: ["self"],
 *             fallback: "none",
 *           },
 *           variableAmountRequired: [
 *             {
 *               requestedProofs: "zkproofOf(human)",
 *               amountRequired: "5000" // 0.005 USDC (50% discount)
 *             }
 *           ],
 *           contentMetadata: [
 *             { proof: "zkproof(verified-source)" }
 *           ]
 *         }
 *       }
 *     }
 *   },
 *   facilitator
 * ));
 * ```
 */

export { paymentMiddleware } from './middleware.js';

// Reusable helpers (production-oriented) for policy distribution/validation
export {
  PROOF_POLICY_ENVELOPE_SCHEMA_V1,
  loadProofPolicyFile,
  parseProofPolicyJson,
  policyIntegrityHashSha256,
} from "./proofs/envelope.js";

// Reusable helpers for proof-cost distribution/validation
export {
  PROOF_COST_ENVELOPE_SCHEMA_V1,
  loadProofCostFile,
  parseProofCostJson,
  proofCostIntegrityHashSha256,
} from "./proofs/costs_envelope.js";


