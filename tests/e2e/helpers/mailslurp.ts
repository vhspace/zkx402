type MailSlurpInbox = {
  id: string;
  emailAddress: string;
};

type MailSlurpEmail = {
  id: string;
  subject?: string;
  body?: string;
  bodyExcerpt?: string;
};

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function mailslurpHeaders(apiKey: string) {
  return {
    'x-api-key': apiKey,
    'content-type': 'application/json',
  };
}

export async function mailslurpCreateInbox(opts?: {
  apiKey?: string;
  expiresInMs?: number;
}): Promise<MailSlurpInbox> {
  const apiKey = opts?.apiKey ?? mustGetEnv('MAILSLURP_API_KEY');
  const expiresAt = opts?.expiresInMs
    ? new Date(Date.now() + opts.expiresInMs).toISOString()
    : undefined;

  const res = await fetch('https://api.mailslurp.com/inboxes', {
    method: 'POST',
    headers: mailslurpHeaders(apiKey),
    body: JSON.stringify(expiresAt ? { expiresAt } : {}),
  });
  if (!res.ok) {
    throw new Error(`MailSlurp createInbox failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as MailSlurpInbox;
  if (!data?.id || !data?.emailAddress) {
    throw new Error(`MailSlurp createInbox returned unexpected payload: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function mailslurpDeleteInbox(inboxId: string, opts?: { apiKey?: string }) {
  const apiKey = opts?.apiKey ?? mustGetEnv('MAILSLURP_API_KEY');
  await fetch(`https://api.mailslurp.com/inboxes/${encodeURIComponent(inboxId)}`, {
    method: 'DELETE',
    headers: mailslurpHeaders(apiKey),
  }).catch(() => {});
}

export async function mailslurpWaitForLatestEmail(
  inboxId: string,
  opts?: { apiKey?: string; timeoutMs?: number; unreadOnly?: boolean },
): Promise<MailSlurpEmail> {
  const apiKey = opts?.apiKey ?? mustGetEnv('MAILSLURP_API_KEY');
  const timeoutMs = opts?.timeoutMs ?? 60_000;
  const unreadOnly = opts?.unreadOnly ?? true;

  const qs = new URLSearchParams({
    inboxId,
    timeout: String(timeoutMs),
    unreadOnly: String(unreadOnly),
  });

  const res = await fetch(`https://api.mailslurp.com/waitForLatestEmail?${qs.toString()}`, {
    method: 'GET',
    headers: mailslurpHeaders(apiKey),
  });
  if (!res.ok) {
    throw new Error(`MailSlurp waitForLatestEmail failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as MailSlurpEmail;
}

export function extractSixDigitOtp(email: MailSlurpEmail): string {
  const haystack = [email.subject, email.bodyExcerpt, email.body].filter(Boolean).join('\n');
  const m = haystack.match(/\b(\d{6})\b/);
  if (!m) {
    throw new Error(
      `Failed to extract 6-digit OTP from email. subject=${email.subject || ''} excerpt=${email.bodyExcerpt || ''}`,
    );
  }
  return m[1];
}


