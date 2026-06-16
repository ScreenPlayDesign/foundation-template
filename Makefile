# ══════════════════════════════════════════════════════════════════════════════
# Makefile — SPD project DSL
#
# The single command surface for developing, testing, and deploying this app.
# Wraps: spd CLI · docker compose · supabase CLI · bun · cloudflare wrangler
#
# Usage:  make              (shows this help)
#         make <target>
#         make scene SCENE="customer pays vendor and merchant gets notified"
#         make run SCENE=payment_flow
#
# Every target delegates to the right underlying tool — you don't need to
# remember docker compose syntax, supabase CLI flags, or spd subcommands.
# This file IS the project's DSL. Read it like documentation.
# ══════════════════════════════════════════════════════════════════════════════

# ── Project identity (read from spd_config.toml) ─────────────────────────────
PROJECT  := $(shell grep '^name' spd_config.toml 2>/dev/null | head -1 | sed 's/.*= *"\(.*\)"/\1/' || echo "spd-project")
VERSION  := $(shell grep '^version' spd_config.toml 2>/dev/null | head -1 | sed 's/.*= *"\(.*\)"/\1/' || echo "0.1.0")
APP_PORT ?= 5173

# ── Tool aliases ──────────────────────────────────────────────────────────────
COMPOSE := docker compose
SPD     := spd
BUN     := bun

# ── Passthrough variables (override on command line) ──────────────────────────
SCENE   ?=   # make scene SCENE="..." or make run SCENE=name
ACTOR   ?=   # make run ACTOR=Buyer
BRANCH  ?=   # make db.push BRANCH=staging

.DEFAULT_GOAL := help
.PHONY: \
  help \
  dev stop restart logs logs.app logs.db logs.pw \
  scene cast run run.smoke report \
  db.push db.push.staging db.reset db.diff db.migrate db.studio db.seed \
  gate gate.staging gate.prod \
  build typecheck lint \
  setup setup.supabase setup.env \
  secrets.list secrets.set \
  env doctor status \
  stripe.listen \
  deploy.staging deploy.prod

# ── Self-documenting help ─────────────────────────────────────────────────────
# Reads ## annotations from each target line. No separate maintenance needed.
help:
	@printf "\n  \033[1m$(PROJECT)\033[0m  v$(VERSION)\n"
	@printf "  ──────────────────────────────────────────────────────────────\n\n"
	@grep -E '^[a-zA-Z_.-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; \
	         /^[a-z]/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }; \
	         /^\t/ { printf "  \033[36m%-22s\033[0m   %s\n", "", $$2 }'
	@printf "\n  \033[2mPass variables: make scene SCENE=\"...\"  make run SCENE=name  make run ACTOR=Buyer\033[0m\n\n"


# ══════════════════════════════════════════════════════════════════════════════
# DEV LIFECYCLE
# ══════════════════════════════════════════════════════════════════════════════

dev: ## Start full local stack: Supabase + Vite HMR (docker compose --profile dev up)
	$(COMPOSE) --profile dev up

dev.d: ## Start full local stack in background (detached)
	$(COMPOSE) --profile dev up -d

stop: ## Stop and remove all containers (data volumes preserved)
	$(COMPOSE) --profile dev --profile pw down

stop.clean: ## Stop and WIPE all volumes — fresh DB next start
	$(COMPOSE) --profile dev --profile pw down -v

restart: stop dev ## Full stop + start

logs: ## Tail logs from all running containers (muxed)
	$(COMPOSE) --profile dev logs -f

logs.app: ## Tail the Vite dev server only
	$(SPD) logs dev

logs.db: ## Tail local Supabase logs
	$(COMPOSE) --profile dev logs -f supabase-db supabase-kong

logs.pw: ## Tail last Playwright run output
	$(SPD) logs playwright


# ══════════════════════════════════════════════════════════════════════════════
# SCREENPLAY  (Gherkin + Playwright)
# ══════════════════════════════════════════════════════════════════════════════

scene: ## List scenes, OR write one: make scene SCENE="description of what happens"
ifdef SCENE
	$(SPD) scene write "$(SCENE)"
else
	$(SPD) scene list
endif

cast: ## List all actors across all scenes
	$(SPD) scene cast

run: ## Run all scenes, OR one: make run SCENE=payment_flow  OR make run ACTOR=Buyer
ifdef ACTOR
	$(SPD) scene run --actor=$(ACTOR)
else ifdef SCENE
	$(SPD) scene run $(SCENE)
else
	$(SPD) scene run
endif

run.smoke: ## Run @smoke-tagged scenes only (fast pre-gate sanity check)
	$(SPD) scene run --smoke

run.headed: ## Run scenes in headed (visible) browser — for debugging
ifdef SCENE
	$(SPD) scene run $(SCENE) --headed
else
	$(SPD) scene run --headed
endif

run.docker: ## Run scenes inside the Playwright Docker container
	$(COMPOSE) --profile pw run --rm playwright

report: ## Open the Playwright HTML walkthrough report
	$(SPD) scene report


# ══════════════════════════════════════════════════════════════════════════════
# DATABASE  (Supabase)
# ══════════════════════════════════════════════════════════════════════════════

db.push: ## Apply pending migrations → local Supabase
	supabase db push --local

db.push.staging: ## Apply pending migrations → cloud staging Supabase
	supabase db push

db.reset: ## Wipe local DB and replay all migrations from zero
	$(SPD) reset --local

db.diff: ## Show schema diff (what's pending vs applied)
	supabase db diff

db.migrate: ## Scaffold a new migration: make db.migrate NAME=add_payments_table
ifdef NAME
	supabase migration new $(NAME)
else
	@echo "  Usage: make db.migrate NAME=add_payments_table"
	@exit 1
endif

db.studio: ## Open Supabase Studio (local DB browser) in the browser
	@open http://localhost:54323 2>/dev/null || xdg-open http://localhost:54323

db.seed: ## Re-run seed.sql against local Supabase
	supabase db reset --local


# ══════════════════════════════════════════════════════════════════════════════
# PIPELINE GATES  (dev → staging → prod)
# ══════════════════════════════════════════════════════════════════════════════

gate: ## Show current gate status and pipeline phase
	$(SPD) gate status

gate.check: ## Pre-flight: is the gate ready to advance?
	$(SPD) gate check

gate.staging: ## Advance: Writing Room → Dress Rehearsal (dev → staging)
	$(SPD) gate advance dev→staging

gate.prod: ## Advance: Dress Rehearsal → Opening Night (staging → prod — blocks for approval)
	$(SPD) gate advance staging→prod


# ══════════════════════════════════════════════════════════════════════════════
# BUILD & QUALITY
# ══════════════════════════════════════════════════════════════════════════════

build: ## Production build (Vite — same as CI)
	$(BUN) run build

typecheck: ## TypeScript check, no emit
	$(BUN) run typecheck

lint: ## Run all quality checks before gating
	$(BUN) run typecheck
	$(SPD) scene run --smoke


# ══════════════════════════════════════════════════════════════════════════════
# INTEGRATIONS
# ══════════════════════════════════════════════════════════════════════════════

stripe.listen: ## Forward Stripe webhooks to local dev server (requires Stripe CLI)
	stripe listen --forward-to localhost:$(APP_PORT)/api/webhook/stripe


# ══════════════════════════════════════════════════════════════════════════════
# SECRETS & ENVIRONMENT
# ══════════════════════════════════════════════════════════════════════════════

secrets.list: ## List all project secrets (values hidden)
	$(SPD) secrets list

secrets.set: ## Set a secret: make secrets.set KEY=STRIPE_SECRET_KEY VALUE=sk_test_...
ifdef KEY
	$(SPD) secrets set $(KEY) $(VALUE)
else
	@echo "  Usage: make secrets.set KEY=STRIPE_SECRET_KEY VALUE=sk_test_..."
	@exit 1
endif

env: ## Show environment detection report (spd env)
	$(SPD) env

doctor: ## Full environment health check with fix hints
	$(SPD) doctor

status: ## Project status dashboard
	$(SPD) status


# ══════════════════════════════════════════════════════════════════════════════
# FIRST-TIME SETUP
# ══════════════════════════════════════════════════════════════════════════════

setup: setup.env setup.supabase ## Full first-time project setup
	$(BUN) install
	@printf "\n  \033[32m✓\033[0m  Setup complete.\n"
	@printf "  Run \033[36mmake dev\033[0m to start the local stack.\n\n"

setup.env: ## Check .env.local exists (copy from .env.example if not)
	@if [ ! -f .env.local ]; then \
	  cp .env.example .env.local; \
	  printf "  \033[33m⚠\033[0m  Created .env.local from .env.example — fill in your values.\n"; \
	else \
	  printf "  \033[32m✓\033[0m  .env.local exists\n"; \
	fi

setup.supabase: ## Initialize Supabase docker stack (one-time)
	@if [ ! -d "supabase/docker" ]; then \
	  printf "  Initializing Supabase local stack...\n"; \
	  supabase init; \
	  supabase start; \
	  supabase db push --local; \
	  printf "  \033[32m✓\033[0m  Supabase local stack initialized\n"; \
	else \
	  printf "  \033[32m✓\033[0m  supabase/docker already exists\n"; \
	fi


# ══════════════════════════════════════════════════════════════════════════════
# DEPLOY  (manual fallback — gates do this automatically via CI)
# ══════════════════════════════════════════════════════════════════════════════

deploy.staging: ## Manual deploy to staging (bypass CI — use sparingly)
	$(BUN) run build
	wrangler pages deploy dist --project-name=$(PROJECT)-staging

deploy.prod: ## Manual deploy to prod (bypass CI — requires gate approval first)
	@printf "  \033[31m⚠  Manual prod deploy.\033[0m Run \033[36mmake gate.prod\033[0m instead to go through the gate.\n"
	@printf "  Type 'yes' to continue: "; read confirm; [ "$$confirm" = "yes" ] || exit 1
	$(BUN) run build
	wrangler pages deploy dist --project-name=$(PROJECT)
