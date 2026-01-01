"use client";

import { ReactNode, useState } from "react";
import { CDPHooksProvider } from "@coinbase/cdp-hooks";
import type { Config } from "@coinbase/cdp-core";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config as wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Next.js replaces NEXT_PUBLIC_* at build time. Preview deployments may not have
  // this configured, so we guard to avoid a hard client-side crash.
  const cdpProjectId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID;
  const cdpDebugging = process.env.NEXT_PUBLIC_CDP_DEBUGGING === "true";

  const content = !cdpProjectId ? (
    <div
      style={{
        padding: 24,
        maxWidth: 720,
        margin: "0 auto",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <h2 style={{ margin: "24px 0 8px", fontSize: 20 }}>
        Missing environment variable
      </h2>
      <p style={{ margin: 0, lineHeight: 1.5, color: "#444" }}>
        This deployment is missing <code>NEXT_PUBLIC_CDP_PROJECT_ID</code>. Set it
        in Vercel for the <strong>Preview</strong> environment (and Production) to
        enable CDP wallet auth.
      </p>
    </div>
  ) : (
    <CDPHooksProvider
      config={
        {
          projectId: cdpProjectId,
          debugging: cdpDebugging,
          ethereum: {
            createOnLogin: "eoa",
          },
        } satisfies Config
      }
    >
      {children}
    </CDPHooksProvider>
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
    </WagmiProvider>
  );
}
