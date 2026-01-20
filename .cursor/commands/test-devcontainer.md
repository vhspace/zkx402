# Test Devcontainer Changes

## Overview
Test devcontainer configuration changes before rebuilding. Validates that the devcontainer can be built successfully (does not bring the container up).

## Quick Start

Use the standalone script (recommended for this repo):

```bash
# Basic validation (uses cached layers - fast)
python tests/test_devcontainer_standalone.py

# With verbose output (recommended - see all build steps)
python tests/test_devcontainer_standalone.py --verbose

# Force fresh build (no cache - slower but more thorough)
python tests/test_devcontainer_standalone.py --no-cache --verbose

# JSON validation only (fast)
python tests/test_devcontainer_standalone.py --json-only
```

## Requirements

- Docker access
- `devcontainer` CLI (see `@devcontainers/cli`)

