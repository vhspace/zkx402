# zkx402 Development Container

This devcontainer provides a consistent development environment for the zkx402 project.

## What's Included

### Core Tools
- **Node.js (LTS)** - For frontend and backend development
- **npm & yarn** - Package managers (via devcontainer features)
- **Foundry** - Ethereum development toolkit (forge, cast, anvil, chisel)
- **1Password CLI (`op`)** - Secrets management (service account token recommended)
- **Docker-in-Docker** - For building and running containers
- **Git** - Version control
- **GitHub CLI** - GitHub command-line tool
- **Oh My Zsh** - Enhanced shell experience

### VS Code Extensions
- Solidity & Smart Contract Development (Hardhat, Solidity)
- JavaScript/TypeScript tooling (Prettier, ESLint)
- Docker support
- Git integration (GitLens)
- GitHub Copilot
- Markdown support
- Shell scripting tools

### Utilities
- Common utilities via devcontainer features

## Getting Started

1. **Prerequisites**
   - Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Install [VS Code](https://code.visualstudio.com/)
   - Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

2. **Open in Container**
   - Open this project in VS Code
   - When prompted, click "Reopen in Container"
   - Or use Command Palette (Ctrl/Cmd+Shift+P): "Dev Containers: Reopen in Container"

3. **First Time Setup**
   - The container image includes Foundry (forge/cast/anvil) and Node via devcontainer features.
   - Install repo dependencies when you need them (some setups may prefer `npm install --ignore-scripts --legacy-peer-deps`).

## 1Password (`op`) Setup (Recommended)

This devcontainer installs the 1Password CLI (`op`) so you can pull secrets at runtime without committing them to the repo.

### Service Account Token (best for CI-like workflows in devcontainers)

1. Create a **1Password Service Account** with access to the vault/items you need.
2. Rebuild the devcontainer ("Dev Containers: Rebuild Container") to ensure `op` is installed.
3. Set `OP_SERVICE_ACCOUNT_TOKEN` **at runtime** (recommended), so it is **not baked into the image**.

Because this devcontainer persists `/home/vscode` in a volume, you can set it once in a local-only shell file.

Inside the container:

```bash
mkdir -p ~/.config/zkx402
cat > ~/.config/zkx402/secrets.env <<'EOF'
export OP_SERVICE_ACCOUNT_TOKEN="op_sa_..."
EOF

echo '\n# zkx402 local secrets (not in git)\n[ -f ~/.config/zkx402/secrets.env ] && source ~/.config/zkx402/secrets.env\n' >> ~/.zshrc
source ~/.zshrc
```

### Usage examples

- Run any command with secrets available:

```bash
op run -- <your command>
```

- Inject secrets into an env file from a template (common pattern):

```bash
op inject -i .env.tpl -o .env
```

## Forwarded Ports

The following ports are automatically forwarded:
- **3000** - Next.js frontend (`apps/demo/client`)
- **3001** - Backend server (`apps/demo/server`)
- **8545** - Local Blockchain (Anvil/Hardhat)

## Development Workflow

### Smart Contracts
```bash
cd apps/demo/contracts

# Compile contracts
forge build

# Run tests
forge test

# Deploy locally
forge script script/DeployReceiver.s.sol --broadcast

# Start local blockchain
anvil
```

### Frontend
```bash
cd apps/demo/client

# Install dependencies (if needed)
npm install

# Run dev server
npm run dev
```

### Backend
```bash
cd apps/demo/server

# Install dependencies (if needed)
npm install

# Start server
npm start
```

## Foundry Commands

- `forge build` - Compile contracts
- `forge test` - Run tests
- `forge test -vvv` - Run tests with verbose output
- `cast` - Interact with contracts
- `anvil` - Local Ethereum node
- `chisel` - Solidity REPL

## Customization

You can customize the devcontainer by editing `.devcontainer/devcontainer.json`:
- Add more VS Code extensions
- Install additional tools
- Change port forwarding
- Modify environment variables

## Persistent Data

The following data persists across container rebuilds:
- Home directory (`/home/vscode`) - Stores shell history, config files, etc.
- Docker data - Container images and volumes

## Troubleshooting

### Container won't start
- Ensure Docker Desktop is running
- Try "Dev Containers: Rebuild Container" from Command Palette

### Foundry not found
```bash
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

### Permission issues
The container runs as the `vscode` user (non-root) for security. If you need sudo access:
```bash
sudo <command>
```

## Resources

- [Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Foundry Book](https://book.getfoundry.sh/)
- [Next.js Documentation](https://nextjs.org/docs)


