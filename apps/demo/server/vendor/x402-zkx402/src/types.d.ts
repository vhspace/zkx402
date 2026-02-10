/**
 * TypeScript type definitions for x402-zkx402 middleware
 */

import type { Request, Response, NextFunction } from 'express';

export interface ProofClaim {
  type: string;
  [key: string]: any;
}

export interface ProofPolicy {
  version: number;
  scope: string;
  claims?: ProofClaim[];
  allowedProviders?: string[];
  preferenceOrder?: string[];
  fallback?: "none" | "soft" | "hard" | string;
}

export interface ProofCostEntry {
  provider: string;
  /**
   * Canonical claim key. Example: "human", "age_gte:21".
   */
  claimKey: string;
  /**
   * Cost in USD micros (stringified integer). Example: "2500" == $0.0025.
   *
   * In v1 we assume USDC (6 decimals) so USD micros map 1:1 to USDC atomic units.
   */
  costUsdMicros: string;
  description?: string;
}

export interface ProofCosts {
  version: number;
  scope: string;
  currency?: "usd_micros" | string;
  /**
   * Commission markup in basis points (bps). Example: 250 == 2.5%.
   */
  defaultCommissionBps?: number;
  entries: ProofCostEntry[];
}

/**
 * Configuration for variable amount requirements (discount tiers)
 */
export interface VariableAmountRequired {
  /**
   * Canonical claim objects required for this tier.
   */
  requiredClaims: ProofClaim[];

  /**
   * Discounted amount in atomic units (e.g., "5000" = 0.005 USDC)
   */
  amountRequired: string;
}

/**
 * Content metadata with zkproof verification
 */
export interface ContentMetadata {
  /**
   * Metadata string about content origin/authorship/provenance.
   * (Not enforced by this middleware.)
   */
  proof: string;
}

/**
 * Extended configuration for zkproof-enabled endpoints
 */
export interface ZkProofExtraConfig {
  /**
   * Array of discount tiers based on zkproof verification
   */
  variableAmountRequired?: VariableAmountRequired[];

  /**
   * Metadata about content provenance and authenticity
   */
  contentMetadata?: ContentMetadata[];

  /**
   * Proof verification policy (canonical claims + provider routing).
   *
   * **Required for secure proof-gated pricing**. If omitted, the middleware will
   * not apply discounts.
   */
  proofPolicy?: ProofPolicy;

  /**
   * Proof verification cost schedule (separate from proofPolicy).
   */
  proofCosts?: ProofCosts;

  /**
   * Additional custom configuration
   */
  [key: string]: any;
}

/**
 * Proof verification result details
 */
export interface ProofVerificationDetail {
  /**
   * Canonical claim key (e.g. "human", "age_gte:21")
   */
  claimKey: string;

  /**
   * The canonical claim that was checked
   */
  claim?: ProofClaim;

  /**
   * Whether the proof was successfully verified
   */
  verified: boolean;

  /**
   * Optional reason if verification failed
   */
  reason?: string;

  /**
   * Optional API verification result (for API-backed providers like `self_api`, `vouch_api`)
   */
  apiResult?: any;

  /**
   * Optional error details if verification failed
   */
  errorDetails?: any;
}

/**
 * Complete proof verification result
 */
export interface ProofVerificationResult {
  /**
   * Whether all required proofs were verified
   */
  isValid: boolean;

  /**
   * Whether user has all required proofs
   */
  hasAllProofs: boolean;

  /**
   * Array of claim keys that failed verification
   */
  missingClaimKeys: string[];

  /**
   * Claim keys the client indicated they want to use for discounts
   */
  presentedClaimKeys: string[];

  /**
   * Claim keys required for this tier
   */
  requiredClaimKeys: string[];

  /**
   * Number of proofs that were verified
   */
  verifiedCount: number;

  /**
   * Total number of proofs required
   */
  totalRequired: number;

  /**
   * Detailed verification results for each proof
   */
  verificationDetails: ProofVerificationDetail[];

  /**
   * Optional machine-readable reason when verification is skipped/disabled.
   */
  reason?: string;
}

/**
 * Verification metadata attached to requests
 */
export interface VerificationMetadata {
  /**
   * Whether user qualified for a discount
   */
  qualified: boolean;

  /**
   * Whether discount was applied
   */
  discountApplied: boolean;

  requiredClaims?: ProofClaim[];

  /**
   * Discounted amount in atomic units (if qualified)
   */
  discountedAmount?: string;

  /**
   * Discounted price in dollar format (if qualified)
   */
  discountedPrice?: string;

  presentedClaims?: ProofClaim[];

  /**
   * Detailed verification result
   */
  verificationResult?: ProofVerificationResult | null;
}

/**
 * Extended Express Request with zkproof verification metadata
 */
export interface ZkProofRequest extends Request {
  /**
   * Verification metadata set by middleware after zkproof verification
   */
  verificationMetadata?: VerificationMetadata | null;
}

/**
 * Route configuration for zkproof-enabled endpoints
 */
export interface ZkProofRouteConfig {
  /**
   * Price in dollar format (e.g., "$0.01")
   */
  price: string;

  /**
   * Network to use (e.g., "base-sepolia", "base")
   */
  network: string;

  /**
   * Additional configuration
   */
  config?: {
    /**
     * Human-readable description of the endpoint
     */
    description?: string;

    /**
     * MIME type of response
     */
    mimeType?: string;

    /**
     * Maximum timeout in seconds
     */
    maxTimeoutSeconds?: number;

    /**
     * Input schema for endpoint
     */
    inputSchema?: any;

    /**
     * Output schema for endpoint
     */
    outputSchema?: any;

    /**
     * Custom paywall HTML
     */
    customPaywallHtml?: string;

    /**
     * Resource URL
     */
    resource?: string;

    /**
     * Whether endpoint is discoverable
     */
    discoverable?: boolean;

    /**
     * Extended zkproof configuration
     */
    extra?: ZkProofExtraConfig;
  };
}

/**
 * Routes configuration object
 * Keys are route patterns (e.g., "GET /api/data")
 */
export interface ZkProofRoutes {
  [routePattern: string]: ZkProofRouteConfig;
}

/**
 * Facilitator configuration (from @coinbase/x402)
 */
export interface Facilitator {
  url?: string;
  createAuthHeaders?: () => Promise<{ verify: any; settle: any }>;
  [key: string]: any;
}

/**
 * Paywall configuration
 */
export interface PaywallConfig {
  cdpClientKey?: string;
  appName?: string;
  appLogo?: string;
  sessionTokenEndpoint?: string;
}

/**
 * Main payment middleware function with zkproof support
 *
 * @param payTo - Ethereum address to receive payments
 * @param routes - Route configurations with zkproof settings
 * @param facilitator - Payment facilitator configuration
 * @param paywall - Optional paywall configuration
 * @returns Express middleware function
 */
export function paymentMiddleware(
  payTo: string,
  routes: ZkProofRoutes,
  facilitator?: Facilitator,
  paywall?: PaywallConfig
): (req: Request, res: Response, next: NextFunction) => Promise<void>;


