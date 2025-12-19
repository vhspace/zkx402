FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

USER root

RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER vscode

RUN curl -L https://foundry.paradigm.xyz | bash \
    && bash -c "source ~/.bashrc && foundryup"

ENV PATH="/home/vscode/.foundry/bin:${PATH}"

