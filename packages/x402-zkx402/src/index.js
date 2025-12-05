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

