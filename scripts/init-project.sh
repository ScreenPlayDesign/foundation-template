#!/usr/bin/env bash
# init-project.sh — run once after creating a new repo from the foundation template.
#
# What this does:
#   1. Creates staging and prod branches from dev (if they don't exist)
#   2. Sets dev as the default GitHub branch
#   3. Applies branch protection: staging requires PR + CI, prod requires PR + 2 reviews + CI
#   4. Sets required GitHub repo variables from arguments or interactive prompts
#   5. Updates spd_config.toml with project-specific values
#
# Usage:
#   bash scripts/init-project.sh \
#     --slug my-project \
#     --org ScreenPlayDesign \
#     --supabase-staging-ref abc123 \
#     --supabase-prod-ref     def456 \
#     --supabase-staging-url  https://abc123.supabase.co \
#     --supabase-prod-url     https://def456.supabase.co \
#     --supabase-staging-anon-key <key> \
#     --supabase-prod-anon-key    <key> \
#     --cloudflare-project    my-project
#
# All flags are optional — the script prompts for anything not supplied.
# Requires: git, gh (authed), jq

set -eo pipefail

# ── helpers ──────────────────────────────────────────────────────────────────
err()  { echo "  ERROR: $*" >&2; exit 1; }
ok()   { echo "  OK    $*"; }
ask()  { local var="$1" prompt="$2"; eval "[ -n \"\${$var}\" ]" && return
         printf "  %s: " "$prompt"; read -r "$var"; }

# ── parse args ────────────────────────────────────────────────────────────────
SLUG="" ORG="" STAGING_REF="" PROD_REF="" STAGING_URL="" PROD_URL=""
STAGING_ANON="" PROD_ANON="" CF_PROJECT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug)                   SLUG="$2";         shift 2 ;;
    --org)                    ORG="$2";           shift 2 ;;
    --supabase-staging-ref)   STAGING_REF="$2";  shift 2 ;;
    --supabase-prod-ref)      PROD_REF="$2";     shift 2 ;;
    --supabase-staging-url)   STAGING_URL="$2";  shift 2 ;;
    --supabase-prod-url)      PROD_URL="$2";     shift 2 ;;
    --supabase-staging-anon-key) STAGING_ANON="$2"; shift 2 ;;
    --supabase-prod-anon-key)    PROD_ANON="$2";    shift 2 ;;
    --cloudflare-project)     CF_PROJECT="$2";   shift 2 ;;
    *) err "Unknown flag: $1" ;;
  esac
done

command -v gh  >/dev/null || err "'gh' not found — install GitHub CLI and run 'gh auth login'"
command -v git >/dev/null || err "'git' not found"

# ── detect repo ───────────────────────────────────────────────────────────────
REMOTE=$(git remote get-url origin 2>/dev/null) || err "Not in a git repo with an 'origin' remote"
REPO=$(echo "$REMOTE" | sed 's|.*github.com[:/]||;s|\.git$||')
[[ -n "$ORG" ]] || ORG="${REPO%%/*}"

# ── prompt for missing values ─────────────────────────────────────────────────
echo
echo "  SPD project init — $REPO"
echo "  ────────────────────────────────────────────────"
ask SLUG            "Project slug (e.g. fastnacht-lancaster)"
ask STAGING_REF     "Supabase staging ref (8-char project ID)"
ask PROD_REF        "Supabase prod ref"
ask STAGING_URL     "Supabase staging URL (https://...supabase.co)"
ask PROD_URL        "Supabase prod URL"
ask STAGING_ANON    "Supabase staging anon key"
ask PROD_ANON       "Supabase prod anon key"
CF_PROJECT="${CF_PROJECT:-$SLUG}"
echo

# ── 1. ensure dev exists locally ──────────────────────────────────────────────
git fetch origin 2>/dev/null || true
git checkout dev 2>/dev/null || git checkout -b dev
ok "on branch dev"

# ── 2. create staging + prod if they don't exist ──────────────────────────────
for branch in staging prod; do
  if git ls-remote --exit-code origin "$branch" >/dev/null 2>&1; then
    ok "$branch already exists on remote"
  else
    git push origin "dev:$branch"
    ok "created $branch from dev"
  fi
done

# ── 3. set dev as default branch ─────────────────────────────────────────────
gh repo edit "$REPO" --default-branch dev
ok "default branch set to dev"

# ── 4. branch protection ─────────────────────────────────────────────────────
# staging: PR required + CI must pass
gh api "repos/$REPO/branches/staging/protection" -X PUT --input - <<STAGING
{
  "required_status_checks": { "strict": true, "contexts": ["test"] },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
STAGING
ok "staging protection: PR + CI"

# prod: PR required + 2 reviews + CI must pass
gh api "repos/$REPO/branches/prod/protection" -X PUT --input - <<PROD
{
  "required_status_checks": { "strict": true, "contexts": ["test"] },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 2,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
PROD
ok "prod protection: PR + 2 reviews + CI"

# delete main if it still exists (main is forbidden in SPD projects)
if git ls-remote --exit-code origin main >/dev/null 2>&1; then
  gh api "repos/$REPO/git/refs/heads/main" -X DELETE
  ok "deleted main (main is forbidden — use dev/staging/prod)"
fi

# ── 5. set repo variables ─────────────────────────────────────────────────────
gh variable set SPD_PROJECT_SLUG     --repo "$REPO" --body "$SLUG"
gh variable set SUPABASE_URL         --repo "$REPO" --body "$STAGING_URL"
gh variable set SUPABASE_ANON_KEY    --repo "$REPO" --body "$STAGING_ANON"
gh variable set VITE_SUPABASE_URL    --repo "$REPO" --body "$STAGING_URL"
gh variable set VITE_SUPABASE_ANON_KEY --repo "$REPO" --body "$STAGING_ANON"
ok "repo variables set (SPD_PROJECT_SLUG, SUPABASE_*, VITE_SUPABASE_*)"

# ── 6. update spd_config.toml ────────────────────────────────────────────────
CFG="spd_config.toml"
if [[ -f "$CFG" ]]; then
  # replace placeholder values in-place
  sed -i.bak \
    -e "s|name *= *\"spd-app-foundation-template\"|name = \"$SLUG\"|" \
    -e "s|org *= *\"ScreenPlayDesign\"|org = \"$ORG\"|" \
    -e "s|repo *= *\"<project>\"|repo = \"${REPO##*/}\"|" \
    -e "s|staging_ref *= *\"<filled-by-provisioning>\"|staging_ref = \"$STAGING_REF\"|" \
    -e "s|prod_ref *= *\"<filled-by-provisioning>\"|prod_ref = \"$PROD_REF\"|" \
    -e "s|<project>-staging\.pages\.dev|${SLUG}-staging.pages.dev|g" \
    -e "s|<project>\.pages\.dev|${SLUG}.pages.dev|g" \
    -e "s|pages_project *= *\"<project>\"|pages_project = \"$CF_PROJECT\"|" \
    "$CFG"
  rm -f "${CFG}.bak"
  git add "$CFG"
  git commit -m "init: configure spd_config.toml for $SLUG" || true
  git push origin dev
  ok "spd_config.toml updated and pushed"
fi

echo
echo "  Done. Project $SLUG is on SPD rails."
echo
echo "  Next steps:"
echo "    1. Set Supabase secrets (GITHUB_APP_PRIVATE_KEY, ANTHROPIC_API_KEY):"
echo "       supabase link --project-ref $STAGING_REF && supabase secrets set ..."
echo "    2. Set repo secrets (CLOUDFLARE_API_TOKEN, SPD_API_TOKEN):"
echo "       gh secret set CLOUDFLARE_API_TOKEN --repo $REPO"
echo "    3. Push to dev to trigger CI + Data Daemon:"
echo "       git push origin dev"
echo "    4. Register project in SPD platform (Supabase SQL editor — spd-prod)."
echo "    See BOOTSTRAP_CHECKLIST.md B0 for the full adoption checklist."
echo
