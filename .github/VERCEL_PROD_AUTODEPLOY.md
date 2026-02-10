## Vercel production auto-deploy (on merge to `main`)

This repo deploys **two Vercel projects**:

- `apps/demo/server` (Express API)
- `apps/demo/client` (Next.js frontend)

We use a GitHub Actions workflow to deploy **both** projects to **production** on every push to `main`:

- Workflow: `.github/workflows/vercel-prod-deploy.yml`

### Required GitHub secret

Add these repository secrets in GitHub:

- **`VERCEL_TOKEN`**: a Vercel personal token with access to the team and both projects.
- **`VERCEL_ORG_ID`**: your Vercel team/org ID (starts with `team_...`).
- **`VERCEL_PROJECT_ID_SERVER`**: Vercel project ID for the backend (starts with `prj_...`).
- **`VERCEL_PROJECT_ID_CLIENT`**: Vercel project ID for the frontend (starts with `prj_...`).

Create one in Vercel: **Account Settings → Tokens**.

### How it works

- On `push` to `main`, the workflow runs:
  - `vercel deploy --prod` in `apps/demo/server`
  - `vercel deploy --prod` in `apps/demo/client`

Additionally, for **pull requests opened from branches in this same repo** (not forks), it will create **Preview deployments**
for both projects.

### Forks (public repo behavior)

Forks do **not** receive repository secrets, so GitHub Actions deploy jobs are skipped by default.

For forks, the recommended setup is:

- Use Vercel’s **Git Integration** on the fork (gives automatic Preview deployments on PRs + Production on `main`)
- Or add the same secrets to the fork if you want GitHub Actions-based deploys.

### Recommended Vercel project settings (monorepo stability)

In the Vercel dashboard for both projects:

- **Node.js Version**: **22.x**
- **Install Command**: `pnpm install --ignore-scripts`

These reduce install/build failures in pnpm workspace monorepos.


