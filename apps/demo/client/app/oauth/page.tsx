'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useIsSignedIn,
  useOAuthState,
  useSignInWithOAuth,
} from '@coinbase/cdp-hooks';

function OAuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useIsSignedIn();
  const { oauthState } = useOAuthState();
  const { signInWithOAuth } = useSignInWithOAuth();

  const provider = (searchParams.get('provider') || '').toLowerCase() as
    | 'google'
    | 'x'
    | 'apple'
    | '';

  const nextPath = searchParams.get('next') || '/';

  const [started, setStarted] = useState(false);

  const origin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    router.replace(nextPath);
  }, [isSignedIn, nextPath, router]);

  useEffect(() => {
    if (started) return;
    if (isSignedIn) return;
    if (!provider) return;

    setStarted(true);
    // This redirects the browser to the OAuth provider; after login, the user is redirected
    // back to this same page and the SDK completes sign-in automatically.
    void signInWithOAuth(provider);
  }, [isSignedIn, provider, signInWithOAuth, started]);

  return (
    <div
      style={{
        padding: 40,
        maxWidth: 720,
        margin: '0 auto',
        fontFamily:
          'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <h1 style={{ margin: '0 0 8px 0' }}>Signing you in…</h1>
      <p style={{ margin: 0, color: '#444', lineHeight: 1.5 }}>
        Provider: <code>{provider || '(missing provider)'}</code>
        <br />
        Returning to: <code>{nextPath}</code>
      </p>

      {oauthState?.status === 'pending' && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 8,
            background: '#fff3cd',
            border: '1px solid #ffecb5',
            color: '#664d03',
          }}
        >
          Completing OAuth…
        </div>
      )}

      {oauthState?.status === 'error' && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 8,
            background: '#ffebee',
            border: '1px solid #ffcdd2',
            color: '#b71c1c',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Social login failed
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {oauthState.errorDescription ||
              oauthState.error ||
              'Unknown OAuth error'}
          </div>
          {origin && (
            <div style={{ marginTop: 12, color: '#7f0000' }}>
              If this mentions “origin/redirect not allowed”, add this to your
              CDP project’s allowed origins:
              <br />
              <code>{origin}</code>
            </div>
          )}
        </div>
      )}

      {!provider && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 8,
            background: '#ffebee',
            border: '1px solid #ffcdd2',
            color: '#b71c1c',
          }}
        >
          Missing <code>provider</code>. Use <code>/oauth?provider=google</code>{' '}
          (or <code>x</code> / <code>apple</code>).
        </div>
      )}
    </div>
  );
}

export default function OAuthPage() {
  // Next.js requires useSearchParams() callers to be wrapped in Suspense.
  return (
    <Suspense fallback={null}>
      <OAuthPageInner />
    </Suspense>
  );
}


