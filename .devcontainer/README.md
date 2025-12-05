# zkx402 Development Container

This devcontainer provides a consistent development environment for the zkx402 project.

## What's Included

### Core Tools
- **Node.js 20.18.1 (LTS)** - For frontend and backend development
- **npm & yarn** - Package managers
- **Foundry** - Ethereum development toolkit (forge, cast, anvil, chisel)
- **Docker-in-Docker** - For building and running containers
- **Git 2.47.1** - Version control
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
- jq, tree, htop
- Network tools (ping, dig, netcat)

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
   - The container will automatically:
     - Install system packages
     - Install Foundry (forge, cast, anvil, chisel)
     - Run `npm install` for project dependencies
   - This may take 5-10 minutes on first run

## Forwarded Ports

The following ports are automatically forwarded:
- **3000** - Next.js Frontend (zkx402-demo/client)
- **3001** - Backend Server (zkx402-demo/server)
- **8545** - Local Blockchain (Anvil/Hardhat)

## Development Workflow

### Smart Contracts
```bash
cd zkx402-demo/contracts

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
cd zkx402-demo/client

# Install dependencies (if needed)
npm install

# Run dev server
npm run dev
```

### Backend
```bash
cd zkx402-demo/server

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

