'use client';

import { Marketplace } from '@/components/Marketplace';
import { Header } from '@/components/Header';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useCurrentUser, useIsSignedIn } from '@coinbase/cdp-hooks';
import { isHumanVerifiedOnBase } from '@/lib/verification';

function ConsumerPageInner() {
  const { isSignedIn } = useIsSignedIn();
  const { currentUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const openModalId = searchParams.get('openModal');
  const [isVerified, setIsVerified] = useState(false);

  const address = currentUser?.evmAccounts?.[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!address) return;
      const verified = await isHumanVerifiedOnBase({
        walletAddress: address,
        baseRegistryAddress: process.env.NEXT_PUBLIC_BASE_REGISTRY_ADDRESS,
      });
      if (!cancelled) setIsVerified(verified);
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Marketplace 
        isWalletConnected={isSignedIn} 
        initialOpenModalId={openModalId}
        isUserVerified={isVerified}
      />
    </div>
  );
}

export default function ConsumerPage() {
  // Next.js requires useSearchParams() callers to be wrapped in Suspense.
  return (
    <Suspense fallback={null}>
      <ConsumerPageInner />
    </Suspense>
  );
}
