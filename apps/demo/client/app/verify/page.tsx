'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  useCurrentUser,
  useIsSignedIn,
  useSignInWithEmail,
  useVerifyEmailOTP,
  useSignInWithSms,
  useVerifySmsOTP,
  useSignOut,
} from '@coinbase/cdp-hooks';
import {
  SelfAppBuilder,
  SelfQRcodeWrapper,
  countries,
  type SelfApp,
} from '@selfxyz/qrcode';
import { ethers } from 'ethers';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isHumanVerifiedOnBase } from '@/lib/verification';

// Contract addresses (you'll update these after deployment)
const CELO_BRIDGE_ADDRESS =
  process.env.NEXT_PUBLIC_CELO_BRIDGE_ADDRESS ||
  '0x0000000000000000000000000000000000000000';
const BASE_REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_BASE_REGISTRY_ADDRESS ||
  '0x0000000000000000000000000000000000000000';

export default function VerifyPage() {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const { isSignedIn } = useIsSignedIn();
  const { signInWithEmail } = useSignInWithEmail();
  const { verifyEmailOTP } = useVerifyEmailOTP();
  const { signInWithSms } = useSignInWithSms();
  const { verifySmsOTP } = useVerifySmsOTP();
  const { signOut } = useSignOut();

  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [error, setError] = useState<string>('');
  const [verificationStatus, setVerificationStatus] = useState<
    'idle' | 'pending' | 'verified'
  >('idle');
  const [isVerified, setIsVerified] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<
    'none' | 'celo_verified' | 'bridging' | 'base_verified'
  >('none');
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [checkCount, setCheckCount] = useState(0);
  const [celoTxHash, setCeloTxHash] = useState<string>('');
  const [baseTxHash, setBaseTxHash] = useState<string>('');
  const [showContinueButton, setShowContinueButton] = useState(false);

  // Auth state
  const [loading, setLoading] = useState(false);
  const [showAuthMethods, setShowAuthMethods] = useState(false);
  const [authStep, setAuthStep] = useState<'method' | 'email' | 'sms' | 'otp'>(
    'method'
  );
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [flowId, setFlowId] = useState('');
  const [authType, setAuthType] = useState<'email' | 'sms'>('email');

  const address = currentUser?.evmAccounts?.[0];
  const excludedCountries = useMemo(() => [], []); // No exclusions

  function extractFlowId(result: any): string | null {
    const id =
      result?.flowId ??
      result?.flow_id ??
      result?.id ??
      result?.data?.flowId ??
      result?.data?.flow_id ??
      result?.data?.id ??
      null;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
  }

  // Debug logging
  useEffect(() => {
    console.log('=== CDP Wallet State ===');
    console.log('isSignedIn:', isSignedIn);
    console.log('currentUser:', currentUser);
    console.log('evmAccounts:', currentUser?.evmAccounts);
    console.log('address:', address);
  }, [isSignedIn, currentUser, address]);

  // Check if already verified on Base
  useEffect(() => {
    if (
      address &&
      BASE_REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000'
    ) {
      checkVerificationStatus();
    }
  }, [address]);

  // Auto-generate QR code when wallet is connected
  useEffect(() => {
    if (
      address &&
      !selfApp &&
      !isVerified &&
      CELO_BRIDGE_ADDRESS !== '0x0000000000000000000000000000000000000000'
    ) {
      generateQRCode();
    }
  }, [address, selfApp, isVerified]);

  // Auth handlers
  const handleEmailSignIn = async () => {
    if (!emailOrPhone) return;

    setLoading(true);
    setError('');

    try {
      const result = await signInWithEmail({ email: emailOrPhone });
      const id = extractFlowId(result);
      if (!id) {
        console.error('signInWithEmail returned unexpected result:', result);
        throw new Error(
          'OTP request sent, but missing flow id. Check your CDP project configuration + browser console.'
        );
      }
      setFlowId(id);
      setAuthType('email');
      setAuthStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to send email');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSmsSignIn = async () => {
    if (!emailOrPhone) return;

    setLoading(true);
    setError('');

    try {
      const result = await signInWithSms({ phoneNumber: emailOrPhone });
      const id = extractFlowId(result);
      if (!id) {
        console.error('signInWithSms returned unexpected result:', result);
        throw new Error(
          'OTP request sent, but missing flow id. Check your CDP project configuration + browser console.'
        );
      }
      setFlowId(id);
      setAuthType('sms');
      setAuthStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to send SMS');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) return;
    if (!flowId) {
      setError('Missing flow id. Please resend OTP.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (authType === 'email') {
        await verifyEmailOTP({ flowId, otp });
      } else {
        await verifySmsOTP({ flowId, otp });
      }
      setShowAuthMethods(false);
      setAuthStep('method');
      setEmailOrPhone('');
      setOtp('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to verify OTP');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'x') => {
    router.push(`/oauth?provider=${provider}&next=${encodeURIComponent('/verify')}`);
  };

  const checkVerificationStatus = async () => {
    if (!address) return;

    try {
      const verified = await isHumanVerifiedOnBase({
        walletAddress: address,
        baseRegistryAddress: BASE_REGISTRY_ADDRESS,
      });
      setIsVerified(verified);
      if (verified) {
        setVerificationStatus('verified');
        // Convenience only (not a proof): persist UI state.
        localStorage.setItem(`verified_${address}`, 'true');
      }
    } catch (err) {
      console.error('Error checking verification:', err);
    }
  };

  const generateQRCode = async () => {
    setError('');

    try {
      // Build Self QR code using workaround for cross-chain detection
      // Use ZeroAddress as userId (neutral, no chain association)
      // Pass real CDP wallet in userDefinedData
      const userAddress =
        address || '0x0000000000000000000000000000000000000000';

      // In Preview environments the bridge contract may not be deployed yet.
      // Still generate a QR by using a non-zero endpoint (fallback to the user's address).
      const endpoint =
        CELO_BRIDGE_ADDRESS === '0x0000000000000000000000000000000000000000'
          ? userAddress
          : CELO_BRIDGE_ADDRESS;

      const app = new SelfAppBuilder({
        version: 2,
        appName: 'CDP Agent Verification',
        scope: 'zkx402', // MUST match contract deployment scope
        // In Preview environments the contract may not be deployed; use a zero-address endpoint so the QR still renders.
        endpoint: endpoint.toLowerCase(), // MUST be lowercase!
        logoBase64: 'https://i.postimg.cc/mrmVf9hm/self.png',
        // If the wallet address isn't available yet in Preview, still render a QR with a neutral placeholder.
        userId: userAddress.toLowerCase(),
        endpointType: 'staging_celo', // Testnet on Celo
        userIdType: 'hex', // Ethereum address format
        userDefinedData: 'CDP Agent Verification', // Just text

        disclosures: {
          // These must match your contract configuration
          minimumAge: 21, // 21+ required
          excludedCountries: excludedCountries, // No exclusions
          nationality: true, // Request nationality for display
        },
      } as any).build();

      console.log('=== QR Code Generated ===');
      console.log('Contract Address:', CELO_BRIDGE_ADDRESS);
      console.log('Scope:', 'zkx402');
      console.log('User ID (CDP Wallet):', userAddress);
      console.log('Endpoint Type:', 'staging_celo');
      console.log('Self App Object:', app);

      setSelfApp(app);
      setShowQR(true);
      setVerificationStatus('pending');

      // Only poll when the contracts are configured.
      if (
        address &&
        CELO_BRIDGE_ADDRESS !== '0x0000000000000000000000000000000000000000' &&
        BASE_REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000'
      ) {
        startPolling();
      }
    } catch (err) {
      console.error('Error generating QR code:', err);
      setError('Failed to generate QR code. Check console for details.');
    }
  };

  const startPolling = () => {
    console.log('Starting polling for verification...');
    setBridgeStatus('celo_verified');

    // Poll every 10 seconds - checking BASE for bridged verification
    const interval = setInterval(async () => {
      if (!address) return;

      setCheckCount((prev) => prev + 1);
      setLastCheckTime(new Date());
      const currentCheck = checkCount + 1;

      console.log(
        `[Poll ${currentCheck}] Checking Base Registry for bridged verification...`
      );

      try {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');

        const abi = ['function isVerified(address) view returns (bool)'];

        const contract = new ethers.Contract(
          BASE_REGISTRY_ADDRESS,
          abi,
          provider
        );

        const isVerified = await contract.isVerified(address);

        console.log(`[Poll ${currentCheck}] Base verification status:`, {
          address: address,
          isVerified: isVerified,
        });

        if (isVerified) {
          console.log('✅ Verification bridged to Base!');

          setBridgeStatus('base_verified');
          setIsVerified(true);
          setVerificationStatus('verified');
          setShowContinueButton(true);
          clearInterval(interval);

          // Store verification status in localStorage
          if (address) {
            localStorage.setItem(`verified_${address}`, 'true');
          }
        } else {
          setBridgeStatus('bridging');
          console.log(
            '⏳ Waiting for Hyperlane to bridge message (2-5 min)...'
          );
        }
      } catch (err) {
        console.error(`[Poll ${currentCheck}] Polling error:`, err);
      }
    }, 10000); // Check every 10 seconds

    // Stop polling after 15 minutes (Hyperlane should be done by then)
    setTimeout(() => {
      clearInterval(interval);
      if (bridgeStatus !== 'base_verified') {
        console.log('❌ Polling timeout - message may have failed to bridge');
        setBridgeStatus('celo_verified'); // Reset to show it's still on Celo
      }
    }, 900000);
  };

  if (!isSignedIn) {
    return (
      <div
        style={{
          padding: '40px',
          maxWidth: '600px',
          margin: '0 auto',
          fontFamily: 'monospace',
        }}
      >
        <h1>verify as human</h1>
        <p style={{ marginBottom: '30px' }}>
          sign in to verify your identity and unlock discounted pricing
        </p>

        {/* Error Message */}
        {error && (
          <div
            style={{
              background: '#ffebee',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              color: '#c62828',
            }}
          >
            {error}
          </div>
        )}

        {/* Auth Flow */}
        {!showAuthMethods ? (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => setShowAuthMethods(true)}
              disabled={loading}
              style={{
                padding: '16px 32px',
                background: '#0052ff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              sign in
            </button>
          </div>
        ) : authStep === 'method' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <button
              onClick={() => setAuthStep('email')}
              disabled={loading}
              style={{
                padding: '12px',
                background: '#0052ff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              email
            </button>
            <button
              onClick={() => setAuthStep('sms')}
              disabled={loading}
              style={{
                padding: '12px',
                background: '#0052ff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              mobile
            </button>
            <button
              onClick={() => handleOAuthSignIn('google')}
              disabled={loading}
              style={{
                padding: '12px',
                background: '#0052ff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              google
            </button>
            <button
              onClick={() => handleOAuthSignIn('x')}
              disabled={loading}
              style={{
                padding: '12px',
                background: '#0052ff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              X
            </button>
            <button
              onClick={() => setShowAuthMethods(false)}
              disabled={loading}
              style={{
                padding: '12px',
                background: '#f5f5f5',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              cancel
            </button>
          </div>
        ) : authStep === 'email' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <input
              type="email"
              placeholder="enter your email"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                color: '#333',
                backgroundColor: '#fff',
              }}
            />
            <button
              onClick={handleEmailSignIn}
              disabled={loading || !emailOrPhone}
              style={{
                padding: '12px',
                background: '#0052ff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {loading ? 'sending...' : 'send OTP'}
            </button>
            <button
              onClick={() => {
                setAuthStep('method');
                setEmailOrPhone('');
              }}
              disabled={loading}
              style={{
                padding: '12px',
                background: '#f5f5f5',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              back
            </button>
          </div>
        ) : authStep === 'sms' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <input
              type="tel"
              placeholder="enter phone (+1234567890)"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                color: '#333',
                backgroundColor: '#fff',
              }}
            />
            <button
              onClick={handleSmsSignIn}
              disabled={loading || !emailOrPhone}
              style={{
                padding: '12px',
                background: '#0052ff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {loading ? 'sending...' : 'send OTP'}
            </button>
            <button
              onClick={() => {
                setAuthStep('method');
                setEmailOrPhone('');
              }}
              disabled={loading}
              style={{
                padding: '12px',
                background: '#f5f5f5',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              back
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <p
              style={{
                fontSize: '14px',
                color: '#666',
                marginBottom: '8px',
              }}
            >
              enter the 6-digit code sent to {emailOrPhone}
            </p>
            <input
              type="text"
              placeholder="enter OTP code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                color: '#333',
                backgroundColor: '#fff',
              }}
            />
            <button
              onClick={handleVerifyOtp}
              disabled={loading || !otp}
              style={{
                padding: '12px',
                background: '#0052ff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {loading ? 'verifying...' : 'verify OTP'}
            </button>
            <button
              onClick={() => {
                setAuthStep('method');
                setEmailOrPhone('');
                setOtp('');
              }}
              disabled={loading}
              style={{
                padding: '12px',
                background: '#f5f5f5',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              back
            </button>
          </div>
        )}

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <Link href="/" style={{ color: '#0052ff' }}>
            ← back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '40px',
        maxWidth: '600px',
        margin: '0 auto',
        fontFamily: 'monospace',
      }}
    >
      {/* Continue Button - Shown at top when verification is complete */}
      {showContinueButton && (
        <div
          style={{
            background: '#e8f5e9',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '30px',
            border: '2px solid #4caf50',
            textAlign: 'center',
          }}
        >
          <h3 style={{ margin: '0 0 15px 0', color: '#2e7d32' }}>
            ✓ verification complete!
          </h3>
          <button
            onClick={() => router.push('/consumer?openModal=3')}
            style={{
              padding: '16px 32px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            continue to marketplace
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <h1 style={{ margin: 0 }}>verify as human</h1>
        <button
          onClick={() => signOut()}
          style={{
            padding: '8px 16px',
            background: '#f5f5f5',
            color: '#333',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          sign out
        </button>
      </div>

      {/* Wallet Info */}
      <div
        style={{
          background: '#e3f2fd',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #2196f3',
        }}
      >
        <p
          style={{
            margin: '0 0 10px 0',
            fontSize: '14px',
            color: '#1976d2',
            fontWeight: 'bold',
          }}
        >
          your cdp wallet:
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: 'monospace',
            fontSize: '13px',
            wordBreak: 'break-all',
            color: '#0d47a1',
          }}
        >
          {address || 'Loading...'}
        </p>
      </div>

      {/* Verification Status */}
      {isVerified && (
        <div
          style={{
            background: '#e8f5e9',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '2px solid #4caf50',
          }}
        >
          <h3 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>
            ✓ verified human
          </h3>
          <p style={{ margin: 0, fontSize: '14px' }}>
            your wallet is verified on base sepolia
          </p>
          <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#666' }}>
            contract:{' '}
            <a
              href={`https://base-sepolia.blockscout.com/address/${BASE_REGISTRY_ADDRESS}?tab=contract`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1976d2', fontFamily: 'monospace' }}
            >
              {BASE_REGISTRY_ADDRESS}
            </a>
          </p>
          <Link
            href="/"
            style={{
              color: '#2e7d32',
              marginTop: '10px',
              display: 'inline-block',
            }}
          >
            ← back to home
          </Link>
        </div>
      )}

      {/* Manual Verification Check */}
      {!isVerified && (
        <div
          style={{
            background: '#f5f5f5',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #ddd',
          }}
        >
          <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>
            check verification status
          </h3>
          <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#666' }}>
            check if your wallet is already verified on base
          </p>
          <button
            onClick={checkVerificationStatus}
            style={{
              padding: '12px 24px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            check now
          </button>
          <p style={{ margin: '15px 0 0 0', fontSize: '12px', color: '#666' }}>
            queries:{' '}
            <a
              href={`https://base-sepolia.blockscout.com/address/${BASE_REGISTRY_ADDRESS}?tab=contract`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1976d2', fontFamily: 'monospace' }}
            >
              {BASE_REGISTRY_ADDRESS}
            </a>
          </p>
        </div>
      )}

      {/* Bridge Status Tracker */}
      {bridgeStatus !== 'none' && (
        <div
          style={{
            background: '#fff9e6',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '2px solid #ffc107',
          }}
        >
          <h3 style={{ margin: '0 0 15px 0', color: '#f57c00' }}>
            🌉 cross-chain bridging status
          </h3>

          {/* Step 1: Celo Verification */}
          <div
            style={{
              marginBottom: '15px',
              paddingLeft: '10px',
              borderLeft:
                bridgeStatus === 'celo_verified' ||
                bridgeStatus === 'bridging' ||
                bridgeStatus === 'base_verified'
                  ? '3px solid #4caf50'
                  : '3px solid #ccc',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                color:
                  bridgeStatus === 'celo_verified' ||
                  bridgeStatus === 'bridging' ||
                  bridgeStatus === 'base_verified'
                    ? '#2e7d32'
                    : '#666',
              }}
            >
              ✓ verified on celo sepolia
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              self protocol verification complete
            </div>
            <a
              href={`https://sepolia.celoscan.io/address/${CELO_BRIDGE_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '11px', color: '#1976d2' }}
            >
              view contract →
            </a>
          </div>

          {/* Step 2: Hyperlane Bridging */}
          <div
            style={{
              marginBottom: '15px',
              paddingLeft: '10px',
              borderLeft:
                bridgeStatus === 'base_verified'
                  ? '3px solid #4caf50'
                  : bridgeStatus === 'bridging'
                  ? '3px solid #ff9800'
                  : '3px solid #ccc',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                color:
                  bridgeStatus === 'base_verified'
                    ? '#2e7d32'
                    : bridgeStatus === 'bridging'
                    ? '#e65100'
                    : '#666',
              }}
            >
              {bridgeStatus === 'bridging'
                ? '⏳ bridging via hyperlane...'
                : bridgeStatus === 'base_verified'
                ? '✓ bridged successfully'
                : '⏸ waiting to bridge'}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              {bridgeStatus === 'bridging'
                ? `checking... (attempt ${checkCount})`
                : bridgeStatus === 'base_verified'
                ? 'message delivered'
                : 'pending verification'}
            </div>
            {lastCheckTime && (
              <div
                style={{ fontSize: '11px', color: '#999', marginTop: '3px' }}
              >
                last checked: {lastCheckTime.toLocaleTimeString()}
              </div>
            )}
            {bridgeStatus === 'bridging' && (
              <div
                style={{
                  fontSize: '11px',
                  color: '#666',
                  marginTop: '5px',
                  fontStyle: 'italic',
                }}
              >
                hyperlane typically takes 2-5 minutes
              </div>
            )}
            {bridgeStatus === 'base_verified' && address && (
              <a
                href={`https://base-sepolia.blockscout.com/address/${BASE_REGISTRY_ADDRESS}?tab=logs`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '11px',
                  color: '#1976d2',
                  marginTop: '5px',
                  display: 'inline-block',
                }}
              >
                view bridge events →
              </a>
            )}
          </div>

          {/* Step 3: Base Verification */}
          <div
            style={{
              paddingLeft: '10px',
              borderLeft:
                bridgeStatus === 'base_verified'
                  ? '3px solid #4caf50'
                  : '3px solid #ccc',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                color: bridgeStatus === 'base_verified' ? '#2e7d32' : '#666',
              }}
            >
              {bridgeStatus === 'base_verified'
                ? '✓ verified on base sepolia'
                : '⏸ waiting for base'}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              {bridgeStatus === 'base_verified'
                ? 'proof of human confirmed!'
                : 'checking every 10 seconds'}
            </div>
            {bridgeStatus === 'base_verified' && (
              <a
                href={`https://base-sepolia.blockscout.com/address/${BASE_REGISTRY_ADDRESS}?tab=contract`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '11px', color: '#1976d2' }}
              >
                view contract →
              </a>
            )}
          </div>
        </div>
      )}

      {!isVerified && (
        <>
          {/* Instructions */}
          <div style={{ marginBottom: '30px' }}>
            <h3>how it works:</h3>
            <ol style={{ lineHeight: '1.8' }}>
              <li>QR code generated automatically below</li>
              <li>open self app on your phone</li>
              <li>scan the qr code</li>
              <li>
                complete verification with mock passport (age 41+, any country)
              </li>
              <li>wait 2-5 minutes for hyperlane to bridge to base</li>
            </ol>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                background: '#ffebee',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                color: '#c62828',
              }}
            >
              {error}
            </div>
          )}

          {!showQR && (
            <div style={{ textAlign: 'center', marginTop: '30px' }}>
              <button
                onClick={generateQRCode}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#111',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                generate qr code
              </button>
            </div>
          )}

          {/* QR Code - Auto-generated */}
          {showQR && selfApp && (
            <div style={{ textAlign: 'center', marginTop: '30px' }}>
              <h3>scan with self app</h3>
              <div
                style={{
                  background: 'white',
                  color: '#111',
                  padding: '20px',
                  borderRadius: '12px',
                  display: 'inline-block',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                <SelfQRcodeWrapper
                  selfApp={selfApp}
                  onSuccess={() => {
                    console.log('✅ Self verification successful!');
                    setVerificationStatus('verified');
                  }}
                  onError={() => {
                    console.error('❌ Self verification failed');
                    setError(`Verification failed`);
                  }}
                />
              </div>

              {/* Status Messages */}
              {verificationStatus === 'pending' && (
                <div
                  style={{
                    marginTop: '20px',
                    background: '#fff3cd',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '1px solid #ff9800',
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 10px 0',
                      fontWeight: 'bold',
                      color: '#f57c00',
                    }}
                  >
                    ⏳ waiting for verification...
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#e65100' }}>
                    1. scan qr with self app
                    <br />
                    2. complete verification
                    <br />
                    3. wait for hyperlane (2-5 min)
                    <br />
                    4. page will update automatically
                  </p>
                </div>
              )}

              <button
                onClick={generateQRCode}
                style={{
                  marginTop: '20px',
                  padding: '10px 20px',
                  background: 'white',
                  color: '#111',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                regenerate qr code
              </button>
            </div>
          )}
        </>
      )}

      {/* Info Box */}
      <div
        style={{
          marginTop: '40px',
          padding: '20px',
          background: '#f5f5f5',
          borderRadius: '8px',
          fontSize: '14px',
        }}
      >
        <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>requirements:</h4>
        <ul
          style={{
            margin: 0,
            paddingLeft: '20px',
            lineHeight: '1.8',
            color: '#333',
          }}
        >
          <li>age: 21+</li>
          <li>excluded countries: none (all allowed!)</li>
          <li>self app with mock passport</li>
        </ul>
      </div>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <Link href="/" style={{ color: '#0052ff' }}>
          ← back to home
        </Link>
      </div>
    </div>
  );
}
