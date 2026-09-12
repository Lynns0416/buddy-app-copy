#!/usr/bin/env bash
# Provision the Azure infrastructure Peace Buddy runs on.
#
#   scripts/azure-provision.sh scripts/azure.env
#
# Creates infrastructure only. Building and deploying application images is
# scripts/deploy.sh. Run this rarely; run that one constantly.
#
# Safe to re-run. Every step checks whether the resource already exists, so a
# partial run can be resumed by running it again.
#
# Cost, all drawn from the Microsoft for Nonprofits grant. Verified 2026-09-12
# against the Azure Retail Prices API for Japan East; see docs/azure-costs.md.
#   Postgres B1ms + 32GB storage   ~$23/month   per server, the meaningful line
#   Container Registry Basic        ~$5/month   $0.1666/day
#   Static public IPv4              ~$7/month   two, at $0.005/hr each
#   Container Apps, scaled to zero   $0         free monthly grant covers it
#   VNet, subnets, private DNS      ~$0.50/mo   the DNS zone; VNet is free
set -euo pipefail

ENV_FILE="${1:?usage: scripts/azure-provision.sh <env-file>}"

# The env file holds the database admin password in cleartext. Refuse to read it
# if anyone but the owner can.
MODE="$(stat -f '%OLp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE")"
if [ "${MODE: -2}" != "00" ]; then
  echo "error: $ENV_FILE is mode $MODE — it holds PG_ADMIN_PASSWORD." >&2
  echo "       run: chmod 600 $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${RESOURCE_GROUP:?}" "${LOCATION:?}" "${ACR_NAME:?}" "${ACA_ENV:?}"
: "${VNET_NAME:?}" "${VNET_CIDR:?}" "${DNS_ZONE:?}"
: "${SUBNET_APPS:?}" "${SUBNET_APPS_CIDR:?}" "${SUBNET_DB:?}" "${SUBNET_DB_CIDR:?}"
: "${PG_SERVER:?}" "${PG_VERSION:?}" "${PG_TIER:?}" "${PG_SKU:?}" "${PG_STORAGE_GB:?}"
: "${PG_DB_NAME:?}" "${PG_ADMIN_USER:?}" "${PG_ADMIN_PASSWORD:?}"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
# Takes the command as separate arguments rather than one string, so a value
# containing a quote cannot change how the command parses.
exists() { [ -n "$("$@" 2>/dev/null)" ]; }

# --- 1. Resource group -------------------------------------------------
# A resource group is a folder. Deleting it deletes everything inside, which
# makes it the undo button for this whole script.
step "Resource group $RESOURCE_GROUP"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# --- 2. Resource providers ---------------------------------------------
# Azure keeps most services switched off on a new subscription. Registration is
# free, takes a couple of minutes, and its absence shows up much later as a
# confusing failure.
step "Register resource providers"
for ns in Microsoft.App Microsoft.ContainerRegistry \
          Microsoft.DBforPostgreSQL Microsoft.OperationalInsights Microsoft.Network; do
  az provider register --namespace "$ns" --output none
done
for ns in Microsoft.App Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL; do
  tries=0
  until [ "$(az provider show --namespace "$ns" --query registrationState -o tsv)" = "Registered" ]; do
    tries=$((tries + 1))
    if [ "$tries" -gt 40 ]; then
      echo "error: $ns is still not Registered after 10 minutes. Check the portal." >&2
      exit 1
    fi
    echo "  waiting for $ns ..."; sleep 15
  done
done

# --- 3. Container registry ---------------------------------------------
# Where the api and web images live. Basic includes 10GB, far more than two
# Node images need. Images are built server-side with `az acr build`, so
# nothing is pushed from a laptop — which also sidesteps ARM/x86 mismatches.
step "Container registry $ACR_NAME"
if ! exists az acr show -n "$ACR_NAME" -g "$RESOURCE_GROUP" --query name -o tsv; then
  az acr create --resource-group "$RESOURCE_GROUP" --name "$ACR_NAME" \
    --sku Basic --location "$LOCATION" --output none
fi

# --- 4. Network --------------------------------------------------------
# The database gets no public endpoint. It is reachable only from inside this
# VNet. Apps and database each need their own subnet, and each subnet is
# delegated to the service that uses it.
#
# The VNet is created empty and each subnet is created by its own guarded step,
# so a run interrupted anywhere in this section resumes correctly. Creating the
# subnet as part of `vnet create` would leave no way to add it on a later run.
step "Virtual network $VNET_NAME"
if ! exists az network vnet show -n "$VNET_NAME" -g "$RESOURCE_GROUP" --query name -o tsv; then
  az network vnet create \
    --resource-group "$RESOURCE_GROUP" --name "$VNET_NAME" \
    --location "$LOCATION" --address-prefixes "$VNET_CIDR" \
    --output none
fi

# A workload-profiles environment requires this delegation. A legacy
# consumption-only environment must NOT have it. Step 5 creates the former.
step "Subnet $SUBNET_APPS, delegated to Container Apps"
if ! exists az network vnet subnet show -n "$SUBNET_APPS" --vnet-name "$VNET_NAME" \
     -g "$RESOURCE_GROUP" --query name -o tsv; then
  az network vnet subnet create \
    --resource-group "$RESOURCE_GROUP" --vnet-name "$VNET_NAME" \
    --name "$SUBNET_APPS" --address-prefixes "$SUBNET_APPS_CIDR" \
    --delegations Microsoft.App/environments \
    --output none
fi

step "Subnet $SUBNET_DB, delegated to Postgres"
if ! exists az network vnet subnet show -n "$SUBNET_DB" --vnet-name "$VNET_NAME" \
     -g "$RESOURCE_GROUP" --query name -o tsv; then
  az network vnet subnet create \
    --resource-group "$RESOURCE_GROUP" --vnet-name "$VNET_NAME" \
    --name "$SUBNET_DB" --address-prefixes "$SUBNET_DB_CIDR" \
    --delegations Microsoft.DBforPostgreSQL/flexibleServers \
    --output none
fi

step "Private DNS zone $DNS_ZONE"
if ! exists az network private-dns zone show -n "$DNS_ZONE" -g "$RESOURCE_GROUP" --query name -o tsv; then
  az network private-dns zone create \
    --resource-group "$RESOURCE_GROUP" --name "$DNS_ZONE" --output none
fi

# --- 5. Container Apps environment -------------------------------------
# The network type is fixed at creation and cannot be changed afterwards, so
# the VNet has to exist first. Ingress stays External because staff reach the
# app from the internet; only the database is private.
#
# Checking only that the name exists is not enough. An environment created
# without a VNet has the right name and the wrong network, and since the network
# type is fixed at creation, a rerun would skip it and report success while the
# apps sit outside the VNet and cannot resolve the database. So the check asks
# whether the environment is VNet-injected, and refuses to continue if it exists
# in the wrong shape.
step "Container Apps environment $ACA_ENV"
ENV_SUBNET="$(az containerapp env show -n "$ACA_ENV" -g "$RESOURCE_GROUP" \
  --query properties.vnetConfiguration.infrastructureSubnetId -o tsv 2>/dev/null || true)"
if [ -n "$ENV_SUBNET" ]; then
  echo "  already VNet-injected"
elif exists az containerapp env show -n "$ACA_ENV" -g "$RESOURCE_GROUP" --query name -o tsv; then
  echo "error: environment $ACA_ENV exists but is not VNet-injected." >&2
  echo "       Its network type cannot be changed. Delete it and rerun:" >&2
  echo "       az containerapp env delete -n $ACA_ENV -g $RESOURCE_GROUP --yes" >&2
  exit 1
else
  APPS_SUBNET_ID=$(az network vnet subnet show \
    --resource-group "$RESOURCE_GROUP" --vnet-name "$VNET_NAME" \
    --name "$SUBNET_APPS" --query id -o tsv)
  az containerapp env create \
    --resource-group "$RESOURCE_GROUP" --name "$ACA_ENV" \
    --location "$LOCATION" \
    --enable-workload-profiles true \
    --infrastructure-subnet-resource-id "$APPS_SUBNET_ID" \
    --output none
fi

# --- 6. Postgres -------------------------------------------------------
# Version matches docker-compose.yml. Private access cannot be switched to
# public later, or the other way round — this choice is permanent.
# High availability is deliberately off: it doubles compute cost to protect an
# internal tool that can tolerate an hour of downtime.
#
# az has no way to read a password from stdin, so it goes on the command line
# and is visible in `ps` for as long as server creation takes. That is why the
# env file must be owner-only. On a shared machine, rotate the password in the
# portal afterwards.
step "Postgres $PG_SERVER"
if ! exists az postgres flexible-server show -n "$PG_SERVER" -g "$RESOURCE_GROUP" --query name -o tsv; then
  az postgres flexible-server create \
    --resource-group "$RESOURCE_GROUP" --name "$PG_SERVER" \
    --location "$LOCATION" \
    --tier "$PG_TIER" --sku-name "$PG_SKU" \
    --storage-size "$PG_STORAGE_GB" --version "$PG_VERSION" \
    --admin-user "$PG_ADMIN_USER" --admin-password "$PG_ADMIN_PASSWORD" \
    --vnet "$VNET_NAME" --subnet "$SUBNET_DB" --private-dns-zone "$DNS_ZONE" \
    --database-name "$PG_DB_NAME" \
    --yes --output none
fi

step "Done"
cat <<SUMMARY

  Resource group   $RESOURCE_GROUP ($LOCATION)
  Registry         $(az acr show -n "$ACR_NAME" -g "$RESOURCE_GROUP" --query loginServer -o tsv)
  Apps environment $ACA_ENV
  Database         $PG_SERVER, private to $VNET_NAME

  DATABASE_URL for the api, using the private hostname:

    postgresql://$PG_ADMIN_USER:<password>@$PG_SERVER.$DNS_ZONE:5432/$PG_DB_NAME?sslmode=require

  That hostname resolves only inside the VNet. It will not work from a laptop.

SUMMARY
