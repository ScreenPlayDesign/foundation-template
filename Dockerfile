# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — Playwright-fixture build. NOT the dev container — that's
# Dockerfile.project (agency-credentialed, spd-managed, used by `spd dev`).
# This one is generic and credential-free on purpose: docker-compose.yml's
# `app` service builds from it solely so Playwright has something to test
# against without needing SPD platform/agency access. See docker-compose.yml's
# header for the full explanation of why there are two Dockerfiles.
#
# Three stages:
#   base   — bun runtime + installed dependencies (shared cache layer)
#   dev    — Vite HMR dev server (docker-compose.yml's `app` service, pw profile)
#   build  — production Vite build (outputs /app/dist for CI or preview)
#
# docker-compose.yml selects the dev stage via `target: dev`.
# CI (Cloudflare Pages) runs `bun run build` directly — it does not use Docker.
# The build stage exists for local production-preview testing only.
#
# Source tree is bind-mounted at /app in dev mode — edits on the host reflect
# immediately. node_modules lives inside the image to prevent host/container
# conflicts (anonymous volume in docker-compose.yml masks /app/node_modules).
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage: base ───────────────────────────────────────────────────────────────
# Install deps as a cacheable layer. Only re-runs when bun.lock changes.
FROM oven/bun:1-alpine AS base

RUN apk add --no-cache git wget

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Stage: dev ────────────────────────────────────────────────────────────────
# Vite HMR server. Source is bind-mounted at runtime by docker-compose.yml.
# usePolling in vite.config.ts handles macOS VirtioFS inotify limitations.
FROM base AS dev

EXPOSE 5173

# --host makes Vite bind to 0.0.0.0 so the port mapping in docker-compose
# reaches the browser on the host.
CMD ["bun", "run", "dev", "--host"]

# ── Stage: build ──────────────────────────────────────────────────────────────
# Full production Vite build. Output lands in /app/dist.
# Usage: docker build --target build -t myapp-build .
#        docker run --rm myapp-build cat /app/dist/index.html  (sanity check)
FROM base AS build

COPY . .
RUN bun run build

# dist is now at /app/dist — copy it out with `docker cp` or mount a volume.
