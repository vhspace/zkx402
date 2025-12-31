#!/usr/bin/env node

/**
 * Updates Cloudflare DNS records to point zkx402.io to Vercel production deployment
 * Usage: node scripts/cloudflare-dns-update.mjs <vercel-url>
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DOMAIN = "zkx402.io";
const RECORD_NAME = "zkx402.io"; // Apex domain
const RECORD_TYPE = "CNAME"; // Vercel recommends CNAME for custom domains

// Get Vercel URL from command line argument
const vercelUrl = process.argv[2];
if (!vercelUrl) {
  console.error("Usage: node scripts/cloudflare-dns-update.mjs <vercel-url>");
  console.error(
    "Example: node scripts/cloudflare-dns-update.mjs https://zkx402.vercel.app"
  );
  process.exit(1);
}

// Extract the domain part from Vercel URL (remove https://)
const targetDomain = vercelUrl.replace(/^https?:\/\//, "");
if (!targetDomain.endsWith(".vercel.app")) {
  console.error("Error: Vercel URL must end with .vercel.app");
  process.exit(1);
}

async function makeCloudflareRequest(endpoint, options = {}) {
  const baseUrl = "https://api.cloudflare.com/client/v4";
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(
      `Cloudflare API error: ${response.status} ${response.statusText}`
    );
    console.error("Response:", data);
    throw new Error(
      `Cloudflare API request failed: ${
        data.errors?.[0]?.message || "Unknown error"
      }`
    );
  }

  return data;
}

async function getZoneId(domain) {
  console.log(`Finding zone ID for domain: ${domain}`);

  const data = await makeCloudflareRequest("/zones");

  const zone = data.result.find((z) => z.name === domain);
  if (!zone) {
    throw new Error(`Zone not found for domain: ${domain}`);
  }

  console.log(`Found zone ID: ${zone.id} for domain: ${domain}`);
  return zone.id;
}

async function getDnsRecord(zoneId, recordName, recordType) {
  console.log(`Finding DNS record: ${recordName} (${recordType})`);

  const data = await makeCloudflareRequest(
    `/zones/${zoneId}/dns_records?name=${encodeURIComponent(
      recordName
    )}&type=${recordType}`
  );

  if (data.result.length === 0) {
    return null;
  }

  const record = data.result[0];
  console.log(
    `Found DNS record: ${record.name} -> ${record.content} (${record.id})`
  );
  return record;
}

async function updateDnsRecord(
  zoneId,
  recordId,
  recordName,
  recordType,
  content
) {
  console.log(`Updating DNS record: ${recordName} -> ${content}`);

  const data = await makeCloudflareRequest(
    `/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        type: recordType,
        name: recordName,
        content: content,
        ttl: 1, // Auto TTL
        proxied: true, // Cloudflare proxy enabled
      }),
    }
  );

  console.log(
    `Successfully updated DNS record: ${data.result.name} -> ${data.result.content}`
  );
  return data.result;
}

async function createDnsRecord(zoneId, recordName, recordType, content) {
  console.log(`Creating DNS record: ${recordName} -> ${content}`);

  const data = await makeCloudflareRequest(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({
      type: recordType,
      name: recordName,
      content: content,
      ttl: 1, // Auto TTL
      proxied: true, // Cloudflare proxy enabled
    }),
  });

  console.log(
    `Successfully created DNS record: ${data.result.name} -> ${data.result.content}`
  );
  return data.result;
}

async function updateDomainDns(vercelUrl) {
  if (!CLOUDFLARE_API_TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN environment variable is required");
  }

  console.log(`Starting DNS update for ${DOMAIN} to point to ${vercelUrl}`);

  try {
    // Get zone ID
    const zoneId = await getZoneId(DOMAIN);

    // Check if record exists
    const existingRecord = await getDnsRecord(zoneId, RECORD_NAME, RECORD_TYPE);

    if (existingRecord) {
      // Update existing record
      if (existingRecord.content === targetDomain) {
        console.log(
          `DNS record already points to ${targetDomain}, no update needed`
        );
        return;
      }

      await updateDnsRecord(
        zoneId,
        existingRecord.id,
        RECORD_NAME,
        RECORD_TYPE,
        targetDomain
      );
    } else {
      // Create new record
      await createDnsRecord(zoneId, RECORD_NAME, RECORD_TYPE, targetDomain);
    }

    console.log(
      `✅ Successfully updated ${DOMAIN} DNS to point to ${vercelUrl}`
    );
    console.log(
      "Note: DNS changes may take a few minutes to propagate globally."
    );
  } catch (error) {
    console.error("❌ Failed to update DNS:", error.message);
    console.log(
      "Note: DNS update failed, but deployment continues. You can manually update DNS or add CLOUDFLARE_API_TOKEN to automate this."
    );
    process.exit(0); // Soft fail - don't break the deployment
  }
}

// Run the update
updateDomainDns(vercelUrl);
