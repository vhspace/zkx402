/**
 * Provenance: ported from vhspace/eXpress402 `src/x402/types.ts`
 * (commit a0904cebeaaf501fb672cb6da2407bba27ad23b6, MIT-compatible owner code).
 * TypeScript interfaces converted to JSDoc typedefs; behavior unchanged.
 */

/**
 * @typedef {object} PaymentResource
 * @property {string} url
 * @property {string} [description]
 * @property {string} [mimeType]
 */

/**
 * @typedef {object} PaymentRequirements
 * @property {string} scheme
 * @property {string} network
 * @property {string} amount
 * @property {string} asset
 * @property {string} payTo
 * @property {number} maxTimeoutSeconds
 * @property {Record<string, unknown>} [extra]
 */

/**
 * @typedef {object} X402ExtensionInfo
 * @property {Record<string, unknown>} info
 * @property {Record<string, unknown>} schema
 */

/**
 * SIWx extension info for wallet authentication.
 * Part of the x402 v2 extensions system.
 *
 * @typedef {object} SIWxExtensionInfo
 * @property {string} domain
 * @property {string} uri
 * @property {string} version
 * @property {string} nonce
 * @property {string} issuedAt
 * @property {string} [expirationTime]
 * @property {string} [statement]
 * @property {string} [notBefore]
 * @property {string} [requestId]
 * @property {string[]} [resources]
 */

/**
 * SIWx payload sent by client in the SIGN-IN-WITH-X header.
 *
 * @typedef {SIWxExtensionInfo & {
 *   address: string,
 *   chainId: string,
 *   type: 'eip191' | 'ed25519',
 *   signature: string,
 * }} SIWxPayload
 */

/**
 * @typedef {object} PaymentRequired
 * @property {2} x402Version
 * @property {string} [error]
 * @property {PaymentResource} resource
 * @property {PaymentRequirements[]} accepts
 * @property {Record<string, any>} [extensions]
 */

/**
 * @typedef {object} PaymentPayload
 * @property {2} x402Version
 * @property {PaymentResource} [resource]
 * @property {PaymentRequirements} accepted
 * @property {Record<string, unknown>} payload
 * @property {Record<string, X402ExtensionInfo>} [extensions]
 */

/**
 * @typedef {object} SettlementResponse
 * @property {boolean} success
 * @property {string} transaction
 * @property {string} network
 * @property {string} [payer]
 * @property {string} [errorReason]
 * @property {Record<string, X402ExtensionInfo>} [extensions]
 */

export {};
