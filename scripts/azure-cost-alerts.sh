#!/usr/bin/env bash
# Create the budgets and the cost anomaly alert that watch the Azure grant.
#
#   scripts/azure-cost-alerts.sh scripts/azure.env       # prod
#   scripts/azure-cost-alerts.sh scripts/azure.stg.env   # staging
#
# Every run writes the two subscription-wide alerts, which are the same whichever
# file is passed. A non-prod run also writes a budget for that environment's
# Postgres server alone. Safe to re-run: each is a PUT, and an existing budget
# keeps the start date it was created with.
#
# WHY A SERVER BUDGET AS WELL
# Staging is stopped by hand and Azure restarts a stopped Flexible Server after
# seven days. Left running, its compute adds about $19 a month to a subscription
# spending $42-60, which a subscription total will not notice for weeks. Filtered
# to the one server, the same $19 is double its normal month. See
# docs/decisions.md 2026-09-13.
#
# WHAT IT CANNOT DO
# Cost data reaches Cost Management a day or more after the usage, so these
# alerts arrive days after staging wakes, not hours. The anomaly alert trains on
# 60 days of history and says nothing useful before then. Neither stops spend.
#
# No confirmation prompt, unlike azure-provision.sh: nothing here costs money or
# is hard to undo. Delete a budget in the portal under Cost Management.
set -euo pipefail

ENV_FILE="${1:?usage: scripts/azure-cost-alerts.sh <env-file>}"

# Same env file as the other azure-*.sh scripts, so the same owner-only check,
# because it holds database passwords this script does not read.
MODE="$(stat -f '%OLp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE")"
if [ "${MODE: -2}" != "00" ]; then
  echo "error: $ENV_FILE is mode $MODE — it holds database passwords." >&2
  echo "       run: chmod 600 $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${RESOURCE_GROUP:?}" "${ENVIRONMENT:?}" "${PG_SERVER:?}"
: "${COST_ALERT_EMAIL:?}" "${BUDGET_ANNUAL_JPY:?}" "${BUDGET_SERVER_MONTHLY_JPY:?}"

# Both values are interpolated into JSON below. Reject anything that could
# change its shape rather than escape it.
if ! [[ "$COST_ALERT_EMAIL" =~ ^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$ ]]; then
  echo "error: COST_ALERT_EMAIL is not a plain email address." >&2
  exit 1
fi
for VAR in BUDGET_ANNUAL_JPY BUDGET_SERVER_MONTHLY_JPY; do
  if ! [[ "${!VAR}" =~ ^[0-9]+$ ]]; then
    echo "error: $VAR must be a whole number of yen." >&2
    exit 1
  fi
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

SUB="$(az account show --query id -o tsv)"
ARM="https://management.azure.com/subscriptions/$SUB"
BUDGET_API="api-version=2023-11-01"

# A budget's start date must be the first of a month and, once in the past,
# inside the current time grain, so a new one starts this month. An existing one
# is re-sent with its own start date, which is what makes a re-run in a later
# month an update rather than a rejected change.
start_date() {
  local existing
  existing="$(az rest --method get --url "$ARM/providers/Microsoft.Consumption/budgets/$1?$BUDGET_API" \
    --query properties.timePeriod.startDate -o tsv 2>/dev/null || true)"
  if [ -n "$existing" ]; then echo "$existing"; else date -u +%Y-%m-01T00:00:00Z; fi
}

notification() { # thresholdType threshold
  cat <<JSON
"${1}_GreaterThan_${2}_Percent": {
  "enabled": true, "operator": "GreaterThan", "threshold": $2,
  "thresholdType": "$1", "contactEmails": ["$COST_ALERT_EMAIL"], "locale": "en-us"
}
JSON
}

# --- 1. Subscription budget, annual ------------------------------------
# Amounts are in the billing currency, which is yen: the grant is $2,000 but Cost
# Management reports this subscription in JPY. Annual, because the grant is.
# 80% actual is the early warning, 100% forecast catches a run rate that would
# get there, 100% actual is the line itself.
BUDGET_ANNUAL="budget-peace-buddy-annual"
step "Budget $BUDGET_ANNUAL, ¥$BUDGET_ANNUAL_JPY a year"
az rest --method put --url "$ARM/providers/Microsoft.Consumption/budgets/$BUDGET_ANNUAL?$BUDGET_API" \
  --output none --body "$(cat <<JSON
{
  "properties": {
    "category": "Cost",
    "amount": $BUDGET_ANNUAL_JPY,
    "timeGrain": "Annually",
    "timePeriod": { "startDate": "$(start_date "$BUDGET_ANNUAL")" },
    "notifications": {
      $(notification Actual 80),
      $(notification Actual 100),
      $(notification Forecasted 100)
    }
  }
}
JSON
)"

# --- 2. Anomaly alert --------------------------------------------------
# Subscription scope is the only one Azure offers. The viewId is the one the
# portal lists alerts by; any other value creates a rule the portal never shows.
# Azure caps the end date at five years from the start and the rule then stops
# silently, so it ends on 31 December four years on and each re-run pushes it out.
ANOMALY="dailyAnomalyPeaceBuddy"
step "Anomaly alert $ANOMALY"
az rest --method put \
  --url "$ARM/providers/Microsoft.CostManagement/scheduledActions/$ANOMALY?api-version=2023-11-01" \
  --output none --body "$(cat <<JSON
{
  "kind": "InsightAlert",
  "properties": {
    "displayName": "Peace Buddy daily cost anomaly",
    "status": "Enabled",
    "viewId": "/subscriptions/$SUB/providers/Microsoft.CostManagement/views/ms:DailyAnomalyByResourceGroup",
    "notificationEmail": "$COST_ALERT_EMAIL",
    "notification": {
      "to": ["$COST_ALERT_EMAIL"],
      "subject": "Peace Buddy: Azure cost anomaly detected"
    },
    "schedule": {
      "frequency": "Daily",
      "startDate": "$(date -u +%Y-%m-%dT00:00:00Z)",
      "endDate": "$(( $(date -u +%Y) + 4 ))-12-31T00:00:00Z"
    }
  }
}
JSON
)"

# --- 3. Server budget, monthly, non-prod only ---------------------------
# Prod's server is always on, so its cost is flat and the subscription budget
# covers it. Staging's is the one that changes by itself.
case "$ENVIRONMENT" in
  prod | production) SERVER_BUDGET="" ;;
  *) SERVER_BUDGET="budget-$PG_SERVER-monthly" ;;
esac
if [ -n "$SERVER_BUDGET" ]; then
  SERVER_ID="$(az postgres flexible-server show -g "$RESOURCE_GROUP" -n "$PG_SERVER" --query id -o tsv)"
  # Forecast trips within days of the run rate changing; actual is the backstop
  # if the forecast has too little history to say anything.
  step "Budget $SERVER_BUDGET, ¥$BUDGET_SERVER_MONTHLY_JPY a month"
  az rest --method put --url "$ARM/providers/Microsoft.Consumption/budgets/$SERVER_BUDGET?$BUDGET_API" \
    --output none --body "$(cat <<JSON
{
  "properties": {
    "category": "Cost",
    "amount": $BUDGET_SERVER_MONTHLY_JPY,
    "timeGrain": "Monthly",
    "timePeriod": { "startDate": "$(start_date "$SERVER_BUDGET")" },
    "filter": { "dimensions": { "name": "ResourceId", "operator": "In", "values": ["$SERVER_ID"] } },
    "notifications": {
      $(notification Actual 100),
      $(notification Forecasted 100)
    }
  }
}
JSON
)"
fi

step "Done"
az rest --method get --url "$ARM/providers/Microsoft.Consumption/budgets?$BUDGET_API" \
  --query "value[].{budget:name, amount:properties.amount, grain:properties.timeGrain, spent:properties.currentSpend.amount, unit:properties.currentSpend.unit}" \
  -o table
cat <<SUMMARY

  Alerts go to $COST_ALERT_EMAIL, from microsoft-noreply@microsoft.com.
  Check that address actually receives mail and that the sender is not filtered.

  The anomaly alert needs 60 days of cost history before it can fire.

SUMMARY
