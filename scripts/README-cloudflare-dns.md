# Cloudflare DNS Update Script

This script automatically updates the DNS records for `zkx402.io` to point to the Vercel production deployment URL.

## Overview

The `cloudflare-dns-update.mjs` script uses the Cloudflare API to:

1. Find the Cloudflare zone for `zkx402.io`
2. Update or create a CNAME record pointing to the Vercel deployment URL
3. Enable Cloudflare proxying for the record

## Usage

```bash
node scripts/cloudflare-dns-update.mjs <vercel-url>
```

Example:
```bash
node scripts/cloudflare-dns-update.mjs https://zkx402.vercel.app
```

## Requirements

- `CLOUDFLARE_API_TOKEN` environment variable must be set with a Cloudflare API token that has DNS edit permissions for the `zkx402.io` zone

## GitHub Actions Integration

This script is automatically called in the Vercel production deployment workflow (`.github/workflows/vercel-prod-deploy.yml`) after a successful frontend deployment.

### Required Secrets (Optional)

Add the following secret to your GitHub repository to enable automatic DNS updates:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with DNS:Edit permissions for the zkx402.io zone

**Note**: If this secret is not set, the DNS update step will be skipped but the deployment will continue successfully.

### How it works

1. After Vercel deploys the frontend to production, the workflow extracts the deployment URL
2. The Cloudflare DNS update script is called with this URL
3. The script updates `zkx402.io` CNAME record to point to the Vercel domain
4. DNS changes propagate (may take a few minutes globally)

## DNS Configuration

- **Record Type**: CNAME
- **Name**: `zkx402.io` (apex domain)
- **Content**: Vercel deployment domain (e.g., `zkx402.vercel.app`)
- **TTL**: Auto (1)
- **Proxy Status**: Proxied (orange cloud enabled)

## Error Handling

- If `CLOUDFLARE_API_TOKEN` is not set, the DNS update step is skipped (soft fail - deployment continues)
- The script validates that the Vercel URL ends with `.vercel.app`
- API errors are logged with detailed error messages but don't fail the deployment
- Existing records are updated; new records are created if none exist
- DNS update failures provide helpful messages about manual alternatives

## Testing

To test locally (requires Cloudflare API token):

```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
node scripts/cloudflare-dns-update.mjs https://test-deployment.vercel.app
```
