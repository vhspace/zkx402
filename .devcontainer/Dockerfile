FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

USER root

# APT cache via apt-cacher-ng on the host (macOS/OrbStack).
# Safe failover: if cache is down, auto-detect returns DIRECT.
ARG APT_CACHE_HOST=host.docker.internal
ARG APT_CACHE_PORT=3142
ENV APT_CACHE_HOST=${APT_CACHE_HOST} \
    APT_CACHE_PORT=${APT_CACHE_PORT}
COPY apt-proxy-detect.sh /usr/local/bin/apt-proxy-detect.sh
COPY apt-proxy-autodetect.conf /etc/apt/apt.conf.d/02proxy-autodetect
RUN chmod +x /usr/local/bin/apt-proxy-detect.sh

RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    build-essential \
    curl \
    gnupg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://downloads.1password.com/linux/keys/1password.asc | gpg --dearmor -o /etc/apt/keyrings/1password-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" > /etc/apt/sources.list.d/1password.list \
    && apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends 1password-cli \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER vscode

RUN curl -L https://foundry.paradigm.xyz | bash \
    && /home/vscode/.foundry/bin/foundryup

ENV PATH="/home/vscode/.foundry/bin:${PATH}"

