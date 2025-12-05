/**
 * TypeScript type definitions for x402-zkx402 middleware
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Zero-knowledge proof string format
 * Examples: "zkproofOf(human)", "zkproofOf(institution=NYT)"
 */
export type ZkProof = string;

/**
 * Configuration for variable amount requirements (discount tiers)
 */
export interface VariableAmountRequired {
  /**
   * Comma-separated list of required zkproofs
   * Example: "zkproofOf(human), zkproofOf(institution=NYT)"
   */
  requestedProofs: string;
  
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
   * Zero-knowledge proof about content origin or authorship
   * Example: "zkproof(Edward Snowden)", "zkproof(verified-journalist)"
   */
  proof: ZkProof;
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
   * Additional custom configuration
   */
  [key: string]: any;
}

/**
 * Proof verification result details
 */
export interface ProofVerificationDetail {
  /**
   * The zkproof that was checked
   */
  proof: ZkProof;
  
  /**
   * Whether the proof was successfully verified
   */
  verified: boolean;
  
  /**
   * Optional reason if verification failed
   */
  reason?: string;
  
  /**
   * Optional API verification result (for institution proofs)
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
   * Array of proofs that failed verification
   */
  missingProofs: ZkProof[];
  
  /**
   * Normalized user proofs (lowercase, trimmed)
   */
  userProofs: ZkProof[];
  
  /**
   * Normalized requested proofs (lowercase, trimmed)
   */
  requestedProofs: ZkProof[];
  
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
  
  /**
   * Comma-separated list of requested proofs (if qualified)
   */
  requestedProofs?: string;
  
  /**
   * Discounted amount in atomic units (if qualified)
   */
  discountedAmount?: string;
  
  /**
   * Discounted price in dollar format (if qualified)
   */
  discountedPrice?: string;
  
  /**
   * User's submitted zkproofs
   */
  userProofs?: ZkProof[];
  
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

