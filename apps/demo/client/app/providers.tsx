"use client";

import { ReactNode, useState } from "react";
import { CDPHooksProvider } from "@coinbase/cdp-hooks";
import type { Config } from "@coinbase/cdp-core";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config as wagmiConfig } from "@/lib/wagmi";

const projectId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID;

// CDP Embedded Wallet config is compiled at build-time in Next.js.
// If `NEXT_PUBLIC_CDP_PROJECT_ID` is missing (commonly on Vercel Preview),
// the SDK can surface this as a generic “network error”.
if (!projectId) {
  throw new Error(
    [
      "Missing NEXT_PUBLIC_CDP_PROJECT_ID.",
      "",
      "Fix:",
      "- Set NEXT_PUBLIC_CDP_PROJECT_ID in the Vercel *frontend* project Environment Variables for BOTH Preview and Production.",
      "- Redeploy the frontend so Next can inline the env var at build time.",
      "- Ensure the deployed origin is allow-listed in your CDP project settings (exact origin, no path).",
    ].join("\n")
  );
}

const cdpConfig: Config = {
  projectId,
  ethereum: {
    createOnLogin: "eoa",
  },
};

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <CDPHooksProvider config={cdpConfig}>
          {children}
        </CDPHooksProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
