#!/usr/bin/env python3
"""
Standalone devcontainer validation script.

This script can be copied to any project and run independently to validate
devcontainer configurations. It doesn't require pytest.

Usage:
    python tests/test_devcontainer_standalone.py [--verbose] [--json-only] [--no-cache]

Or make it executable:
    chmod +x tests/test_devcontainer_standalone.py
    ./tests/test_devcontainer_standalone.py
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def find_devcontainer_config() -> tuple[Path, Path]:
    """Find devcontainer.json location."""
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent

    # Check common locations
    devcontainer_dir = repo_root / ".devcontainer"
    devcontainer_json = devcontainer_dir / "devcontainer.json"

    if devcontainer_json.exists():
        return devcontainer_dir, devcontainer_json

    root_json = repo_root / ".devcontainer.json"
    if root_json.exists():
        return repo_root, root_json

    raise FileNotFoundError(
        "Could not find devcontainer.json. Expected:\n"
        "  - .devcontainer/devcontainer.json\n"
        "  - .devcontainer.json"
    )


def require_cmd(cmd: str) -> None:
    """Check if command exists."""
    if shutil.which(cmd) is None:
        print(f"ERROR: Required command not found: {cmd}", file=sys.stderr)
        sys.exit(1)


def preflight_checks(*, json_only: bool) -> bool:
    """Run preflight checks for required tools.

    Note: Some environments (like minimal CI images) may not have a complete
    Python stdlib available. This script avoids Python's `json` module and uses
    Node.js for JSON parsing instead.
    """
    checks: list[tuple[str, str]] = [
        ("node", "Node.js (used to validate JSON)"),
    ]

    if not json_only:
        checks.extend(
            [
                ("docker", "Docker daemon"),
                # Optional: if missing, we'll fall back to `docker build`.
                ("devcontainer", "Devcontainer CLI (optional)"),
            ]
        )

    failed = False
    for cmd, desc in checks:
        if shutil.which(cmd) is None:
            print(f"ERROR: {desc} not found. Install {cmd} first.", file=sys.stderr)
            failed = True
        else:
            # Test functionality
            if cmd == "docker":
                proc = subprocess.run(["docker", "info"], capture_output=True, text=True, check=False)
                if proc.returncode != 0:
                    print("ERROR: Docker daemon not accessible. Start Docker first.", file=sys.stderr)
                    failed = True
            elif cmd == "devcontainer":
                # Optional tool: if present but broken, we still have a docker fallback.
                proc = subprocess.run(["devcontainer", "--version"], capture_output=True, text=True, check=False)
                if proc.returncode != 0:
                    print("WARN: Devcontainer CLI present but not working; will fall back to `docker build`.", file=sys.stderr)

    return not failed


def validate_json() -> bool:
    """Validate devcontainer.json syntax and structure."""
    print("✓ Validating devcontainer.json...")
    try:
        devcontainer_dir, devcontainer_json = find_devcontainer_config()
        # Use Node.js to parse/validate JSON to avoid relying on Python's stdlib `json`.
        node_script = r"""
const fs = require('fs');
const path = require('path');

const devcontainerJson = process.argv[2];
const devcontainerDir = process.argv[3];

function stripJsoncComments(input) {
  let out = '';
  let i = 0;
  let inString = false;
  let quote = '';
  let escape = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < input.length) {
    const ch = input[i];
    const nxt = i + 1 < input.length ? input[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        out += ch;
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && nxt === '/') {
        inBlockComment = false;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\\\') {
        escape = true;
      } else if (ch === quote) {
        inString = false;
        quote = '';
      }
      i += 1;
      continue;
    }

    if (ch === '/' && nxt === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === '/' && nxt === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

const raw = fs.readFileSync(devcontainerJson, 'utf8');
const data = JSON.parse(stripJsoncComments(raw));

if (typeof data !== 'object' || data === null || Array.isArray(data)) {
  throw new Error('devcontainer.json must be a JSON object');
}

if (!('build' in data) && !('image' in data)) {
  throw new Error("devcontainer.json must have either 'build' or 'image'");
}

if (data.build && typeof data.build === 'object' && data.build.dockerfile) {
  const dockerfilePath = path.join(devcontainerDir, data.build.dockerfile);
  if (!fs.existsSync(dockerfilePath)) {
    throw new Error('Dockerfile not found: ' + dockerfilePath);
  }
}

console.log('OK');
""".strip()

        proc = subprocess.run(
            ["node", "-e", node_script, str(devcontainer_json), str(devcontainer_dir)],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "").strip()
            print(f"ERROR: Invalid devcontainer.json: {err}", file=sys.stderr)
            return False

        print("  ✓ JSON is valid")
        print("  ✓ Required fields present")
        return True

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return False


def test_build(verbose: bool = False, no_cache: bool = False) -> bool:
    """Test devcontainer build."""
    print("\nTesting build...")
    if no_cache:
        print("  (no-cache mode: fresh build, will be slower)")

    # repo_root should be project root; handle both layouts
    devcontainer_dir, devcontainer_json = find_devcontainer_config()
    repo_root = devcontainer_json.parent.parent if devcontainer_json.parent.name == ".devcontainer" else devcontainer_json.parent

    env = dict(os.environ)
    env.setdefault("DOCKER_BUILDKIT", "1")

    if shutil.which("devcontainer") is not None:
        cmd = ["devcontainer", "build", "--workspace-folder", str(repo_root)]
        if verbose:
            cmd.extend(["--log-level", "debug"])
        if no_cache:
            cmd.append("--no-cache")

        proc = subprocess.run(
            cmd,
            cwd=repo_root,
            env=env,
            capture_output=not verbose,
            text=True,
            check=False,
        )
    else:
        # Fallback when devcontainer CLI isn't installed: build the Dockerfile directly.
        print("  (devcontainer CLI not found; falling back to `docker build` of the Dockerfile)")
        dockerfile = devcontainer_dir / "Dockerfile"
        if not dockerfile.exists():
            print(f"  ✗ Dockerfile not found: {dockerfile}", file=sys.stderr)
            return False

        cmd = [
            "docker",
            "build",
            "-f",
            str(dockerfile),
            "-t",
            "zkx402-devcontainer-test:local",
        ]
        if no_cache:
            cmd.append("--no-cache")
        if verbose:
            cmd.extend(["--progress=plain"])
        cmd.append(str(repo_root))

        proc = subprocess.run(
            cmd,
            cwd=repo_root,
            env=env,
            capture_output=not verbose,
            text=True,
            check=False,
        )

    if proc.returncode != 0:
        print("  ✗ Build failed", file=sys.stderr)
        if not verbose:
            print(f"  stdout: {proc.stdout}", file=sys.stderr)
            print(f"  stderr: {proc.stderr}", file=sys.stderr)
        return False

    print("  ✓ Build succeeded")
    return True


def main():
    parser = argparse.ArgumentParser(description="Validate devcontainer configuration")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed build output")
    parser.add_argument("--no-cache", action="store_true", help="Force fresh build without cache")
    parser.add_argument("--json-only", action="store_true", help="Validate JSON only, skip build")

    args = parser.parse_args()

    # Preflight checks
    if not preflight_checks(json_only=args.json_only):
        sys.exit(1)

    # Override with environment variables
    verbose = args.verbose or os.environ.get("DEVCONTAINER_VERBOSE") == "1"
    no_cache = args.no_cache or os.environ.get("DEVCONTAINER_NO_CACHE") == "1"

    print("Devcontainer Validation")
    print("=" * 50)

    success = True

    # Always validate JSON
    if not validate_json():
        success = False

    # Build test (unless json-only)
    if not args.json_only:
        if not test_build(verbose=verbose, no_cache=no_cache):
            success = False

    print("\n" + "=" * 50)
    status = "PASSED" if success else "FAILED"
    print(f"Result: {status}")
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

