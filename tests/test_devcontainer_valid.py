"""
Generic Dev Container validation tests.

This test suite validates devcontainer configurations and can be used in any project.
It automatically detects the devcontainer.json location and works with various configurations.

To use in your project:
1. Copy this file to your tests/ directory
2. Ensure pytest is installed
3. Run: pytest tests/test_devcontainer_valid.py -m slow -v

Environment variables:
- DEVCONTAINER_VERBOSE=1: Show verbose build output
- DEVCONTAINER_BUILD_TIMEOUT_SECONDS: Timeout for builds (default: 1800)
- DEVCONTAINER_SKIP_POSTCREATE: Skip postCreateCommand validation (default: false)
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest


def _strip_jsonc_comments(text: str) -> str:
    """Remove // and /* */ comments from JSONC while preserving strings."""
    out: list[str] = []
    i = 0
    n = len(text)
    in_string = False
    string_quote = ""
    escape = False
    in_line_comment = False
    in_block_comment = False

    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
                out.append(ch)
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
            else:
                i += 1
            continue

        if in_string:
            out.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == string_quote:
                in_string = False
                string_quote = ""
            i += 1
            continue

        # Not in string/comment: detect comment starts
        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue

        # Detect string start
        if ch in ("'", '"'):
            in_string = True
            string_quote = ch
            out.append(ch)
            i += 1
            continue

        out.append(ch)
        i += 1

    return "".join(out)


def _find_devcontainer_config() -> tuple[Path, Path]:
    """
    Find devcontainer.json and its directory.

    Looks for:
    1. .devcontainer/devcontainer.json (most common)
    2. .devcontainer.json (root level, less common)
    """
    # Start from the test file location and walk up to find project root
    test_file = Path(__file__).resolve()
    current = test_file.parent

    # Walk up to find project root (look for common markers)
    for _ in range(10):  # Limit search depth
        devcontainer_dir = current / ".devcontainer"
        devcontainer_json = devcontainer_dir / "devcontainer.json"

        if devcontainer_json.exists():
            return devcontainer_dir, devcontainer_json

        # Also check for root-level .devcontainer.json
        root_json = current / ".devcontainer.json"
        if root_json.exists():
            return current, root_json

        # Check if we've gone too far (reached filesystem root)
        if current.parent == current:
            break
        current = current.parent

    raise AssertionError(
        "Could not find devcontainer.json. Expected one of:\n"
        "  - .devcontainer/devcontainer.json\n"
        "  - .devcontainer.json (at project root)"
    )


def _repo_root() -> Path:
    """Find the repository root (where devcontainer.json is located)."""
    _, devcontainer_json = _find_devcontainer_config()
    return devcontainer_json.parent.parent if devcontainer_json.parent.name == ".devcontainer" else devcontainer_json.parent


def _require_cmd(cmd: str) -> None:
    """Require that a command exists in PATH."""
    if shutil.which(cmd) is None:
        pytest.skip(f"Required command not found in PATH: {cmd}. Skipping devcontainer tests.")


def _require_docker_access() -> None:
    """Require that Docker is accessible."""
    proc = subprocess.run(
        ["docker", "info"],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        pytest.skip(
            "Docker is not available for devcontainer build.\n"
            "If you're running inside a devcontainer, ensure Docker access is available.\n\n"
            f"stdout:\n{proc.stdout}\n\nstderr:\n{proc.stderr}"
        )


def test_devcontainer_json_is_parseable_and_references_exist() -> None:
    """
    Validate that devcontainer.json exists and is well-formed.

    Checks:
    - JSON is valid and parseable
    - Required fields exist
    - Referenced files (Dockerfile, etc.) exist
    """
    devcontainer_dir, devcontainer_json = _find_devcontainer_config()

    # Parse JSON
    try:
        raw = devcontainer_json.read_text(encoding="utf-8")
        data = json.loads(_strip_jsonc_comments(raw))
    except json.JSONDecodeError as e:
        raise AssertionError(f"devcontainer.json is not valid JSON: {e}")

    assert isinstance(data, dict), "devcontainer.json must be a JSON object"

    # Basic fields
    if "name" in data:
        assert isinstance(data["name"], str) and data["name"].strip(), "name must be a non-empty string"

    # Workspace folder is optional but if present should be valid
    if "workspaceFolder" in data:
        assert isinstance(data["workspaceFolder"], str) and data["workspaceFolder"].strip(), "workspaceFolder must be a non-empty string"

    # Remote user is optional
    if "remoteUser" in data:
        assert isinstance(data["remoteUser"], str) and data["remoteUser"].strip(), "remoteUser must be a non-empty string"

    # Build configuration
    build = data.get("build")
    if build is not None:
        assert isinstance(build, dict), "build must be an object"

        # Dockerfile reference
        dockerfile_rel = build.get("dockerfile")
        if dockerfile_rel:
            assert isinstance(dockerfile_rel, str) and dockerfile_rel.strip(), "build.dockerfile must be a non-empty string"
            dockerfile_path = (devcontainer_dir / dockerfile_rel).resolve()
            assert dockerfile_path.exists(), f"Referenced Dockerfile does not exist: {dockerfile_path}"

            # Validate Dockerfile content
            dockerfile_text = dockerfile_path.read_text(encoding="utf-8")
            assert dockerfile_text.strip() != "", f"Dockerfile is empty: {dockerfile_path}"
            assert "FROM " in dockerfile_text, f"Dockerfile missing FROM: {dockerfile_path}"

        # Context reference (optional)
        context_rel = build.get("context")
        if context_rel is not None:
            assert isinstance(context_rel, str) and context_rel.strip(), "build.context must be a non-empty string"
            context_path = (devcontainer_dir / context_rel).resolve()
            assert context_path.exists(), f"Referenced build context does not exist: {context_path}"

    # Image reference (alternative to build)
    image = data.get("image")
    if image is not None:
        assert isinstance(image, str) and image.strip(), "image must be a non-empty string"

    # At least one of build or image must be present
    if build is None and image is None:
        raise AssertionError("devcontainer.json must have either 'build' or 'image' configuration")

    # Features (optional but common)
    features = data.get("features")
    if features is not None:
        assert isinstance(features, dict), "features must be an object"
        for k, v in features.items():
            assert isinstance(k, str) and k.strip(), f"features key must be a non-empty string: {k!r}"
            assert isinstance(v, dict), f"features[{k!r}] must be an object"


@pytest.mark.slow
@pytest.mark.no_cover
def test_devcontainer_build_succeeds() -> None:
    """
    Perform an actual devcontainer build.

    This validates:
    - devcontainer.json is internally consistent
    - Features can be resolved (if used)
    - Dockerfile builds successfully (if using build config)

    Note: By default, Docker uses cached layers for faster builds. Set
    DEVCONTAINER_NO_CACHE=1 to force a fresh build (slower but more thorough).

    Set DEVCONTAINER_VERBOSE=1 to see all build output in real-time.
    """
    _require_cmd("docker")
    _require_cmd("devcontainer")
    _require_docker_access()

    repo = _repo_root()

    env = dict(os.environ)
    env.setdefault("DOCKER_BUILDKIT", "1")
    verbose = os.environ.get("DEVCONTAINER_VERBOSE", "").lower() in ("1", "true", "yes")
    no_cache = os.environ.get("DEVCONTAINER_NO_CACHE", "").lower() in ("1", "true", "yes")
    timeout_s = int(env.get("DEVCONTAINER_BUILD_TIMEOUT_SECONDS", "1800"))

    cmd = ["devcontainer", "build", "--workspace-folder", str(repo)]
    if verbose:
        cmd.extend(["--log-level", "debug"])
    if no_cache:
        cmd.append("--no-cache")

    # When verbose, don't capture output so it streams in real-time
    if verbose:
        proc = subprocess.run(
            cmd,
            cwd=repo,
            env=env,
            capture_output=False,
            text=True,
            check=False,
            timeout=timeout_s,
        )
        stdout = ""
        stderr = ""
        returncode = proc.returncode
    else:
        proc = subprocess.run(
            cmd,
            cwd=repo,
            env=env,
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout_s,
        )
        stdout = proc.stdout
        stderr = proc.stderr
        returncode = proc.returncode

    if returncode != 0:
        error_msg = "devcontainer build failed."
        if verbose:
            error_msg += "\n\nCheck output above for details."
        else:
            error_msg += f"\n\nstdout:\n{stdout}\n\nstderr:\n{stderr}"
            error_msg += "\n\nSet DEVCONTAINER_VERBOSE=1 to see build output in real-time."
        raise AssertionError(error_msg)

