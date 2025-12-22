# Vercel Deployment Guide

## Overview

This project consists of two separate deployments on Vercel:
1. **Backend API** (`apps/demo/server/`)
2. **Frontend** (`apps/demo/client/`)

## Prerequisites

1. Install Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

### Optional: Node-based helpers (recommended)

From repo root:

- Deploy both projects interactively: `npm run vercel:deploy`
- Set env vars from your local environment: `npm run vercel:env`

## Backend Deployment (API Server)

### Important note (why the old guide often fails)

This backend is an Express app, and on Vercel it must run as a **serverless handler** (no `app.listen(...)`).
The server now exports `export default app;` and only calls `listen(...)` when **not** running on Vercel.

Also, the demo server depends on the local workspace package `packages/x402-zkx402`. For Vercel, the server uses a local file dependency:

- `apps/demo/server/package.json` → `"x402-zkx402": "file:../../../packages/x402-zkx402"`

### 1. Navigate to server directory:
```bash
cd apps/demo/server
```

### 2. Deploy to Vercel:
```bash
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account/team
- Link to existing project? **N** (first time)
- Project name? **zkx402-api** (or your preference)
- In which directory is your code located? **./** (current directory)

### 3. Set Environment Variables:

After deployment, set these environment variables in Vercel dashboard or via CLI:

```bash
vercel env add CDP_API_KEY_ID
vercel env add CDP_API_KEY_SECRET
vercel env add RECEIVER_WALLET
vercel env add ALLOWED_ORIGINS
```

Or via Vercel Dashboard:
- Go to your project settings
- Navigate to "Environment Variables"
- Add:
  - `CDP_API_KEY_ID`: Your Coinbase CDP API Key ID
  - `CDP_API_KEY_SECRET`: Your Coinbase CDP API Secret Key
  - `RECEIVER_WALLET`: Wallet address that receives payments
  - `ALLOWED_ORIGINS`: Comma-separated list of allowed frontend origins

Optional (proof-aware pricing / vlayer):
- `ENABLE_PROOF_POLICY=true`
- `ENABLE_PROOF_COSTS=true`
- `SELF_RPC_URL` + `BASE_PROOF_OF_HUMAN_RECEIVER` (for chain-based Self checks)
- `VLAYERS_RPC_URL` + `VLAYERS_PROOF_REGISTRY` (for `vlayer_chain`)
- `VLAYERS_API_URL` (+ `VLAYERS_API_KEY`) (for `vlayer_api`)

### 4. Deploy to Production:
```bash
vercel --prod
```

### 5. Note your API URL:
Your API will be available at: `https://zkx402-api-<hash>.vercel.app`
Save this URL for the frontend configuration.

## Frontend Deployment

### 1. Navigate to client directory:
```bash
cd ../client
```

### 2. Update API URL (if needed):

If you have a `.env.local` or environment configuration, update it with your backend URL:
```bash
NEXT_PUBLIC_API_URL=https://your-api-url.vercel.app
```

### 3. Deploy to Vercel:
```bash
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account/team
- Link to existing project? **N** (first time)
- Project name? **zkx402-client** (or your preference)
- In which directory is your code located? **./** (current directory)
- Override settings? **N** (Vercel auto-detects Next.js)

### 4. Set Environment Variables:

```bash
vercel env add NEXT_PUBLIC_API_URL
```

Enter your backend API URL when prompted.

Additional environment variables (if needed):
```bash
vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
vercel env add NEXT_PUBLIC_CDP_PROJECT_ID
# Add any other environment variables your frontend needs
```

### 4.1 Re-check the client Vercel config

The frontend Vercel config should not reference missing Vercel “secret aliases” by default.
Set `NEXT_PUBLIC_API_URL` in the Vercel project Environment Variables instead.

### 5. Deploy to Production:
```bash
vercel --prod
```

## Post-Deployment

### Update CORS (Backend)

If your frontend domain is different from localhost, update the CORS configuration in `server/index.js`:

```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://your-frontend-url.vercel.app'
  ]
}));
```

Then redeploy the backend:
```bash
cd apps/demo/server
vercel --prod
```

## Continuous Deployment

### Option 1: GitHub Integration (Recommended)

1. Push your code to GitHub
2. Import your project in Vercel dashboard
3. Configure two projects:
  - **zkx402-api**: Root Directory = `apps/demo/server`
  - **zkx402-client**: Root Directory = `apps/demo/client`
4. Set environment variables in Vercel dashboard
5. Enable automatic deployments

### Option 2: CLI Deployment

Link your local projects to Vercel:

```bash
# Backend
cd apps/demo/server
vercel link

# Frontend
cd ../client
vercel link
```

Deploy updates:
```bash
# Backend
cd apps/demo/server
vercel --prod

# Frontend
cd ../client
vercel --prod
```

## Node “no-shell” helpers (recommended)

Instead of bash scripts, use the Node helpers shipped in this repo:

```bash
npm run vercel:deploy
```

To set environment variables non-interactively (values read from your local environment):

```bash
export CDP_API_KEY_ID="..."
export CDP_API_KEY_SECRET="..."
export RECEIVER_WALLET="0x..."
export NEXT_PUBLIC_CDP_PROJECT_ID="..."
export NEXT_PUBLIC_API_URL="https://<your-backend>.vercel.app"
npm run vercel:env
```

## Troubleshooting

### Backend Issues

**Error: Module not found**
- Ensure all dependencies are in `package.json`
- Run `npm install` locally to verify
- Redeploy with `vercel --prod`

**Error: Function execution timeout**
- Check Vercel logs: `vercel logs`
- Verify CDP API credentials are correct
- Check network connectivity to external services

### Frontend Issues

**Error: Cannot connect to API**
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check CORS configuration on backend
- Ensure API is deployed and accessible

**Build errors**
- Check build logs: `vercel logs`
- Test build locally: `npm run build`
- Verify all dependencies are installed

### Environment Variables

View current environment variables:
```bash
vercel env ls
```

Update environment variable:
```bash
vercel env rm VARIABLE_NAME
vercel env add VARIABLE_NAME
```

## Monitoring

### View Logs

Backend logs:
```bash
cd apps/demo/server
vercel logs
```

Frontend logs:
```bash
cd apps/demo/client
vercel logs
```

### Vercel Dashboard

Access detailed metrics, logs, and analytics at:
https://vercel.com/dashboard

## Local Development

Test locally before deploying:

```bash
# Backend
cd apps/demo/server
npm install
npm start

# Frontend (in another terminal)
cd apps/demo/client
npm install
npm run dev
```

## Production URLs

After deployment, your URLs will be:
- **Backend API**: `https://zkx402-api.vercel.app` (or your custom domain)
- **Frontend**: `https://zkx402-client.vercel.app` (or your custom domain)

## Custom Domains (Optional)

Add custom domains in Vercel dashboard:
1. Go to Project Settings → Domains
2. Add your domain
3. Configure DNS records as instructed
4. Update environment variables with new URLs

## Security Checklist

- [ ] All API keys stored as environment variables (not in code)
- [ ] CORS configured for production domains only
- [ ] Rate limiting configured (if needed)
- [ ] HTTPS enabled (automatic with Vercel)
- [ ] Environment variables set for production
- [ ] Sensitive data not logged or exposed

## Cost Considerations

Vercel Free Tier includes:
- 100GB bandwidth per month
- Serverless function execution
- Automatic HTTPS
- Global CDN

Monitor usage in Vercel dashboard to avoid overages.

## Support

- Vercel Documentation: https://vercel.com/docs
- Vercel Support: support@vercel.com
- GitHub Issues: [Your repo issues page]

