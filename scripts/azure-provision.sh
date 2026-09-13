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
#   Storage account, Hot LRS         ~$0        $0.02/GB/mo; photos are megabytes
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
: "${ACR_PULL_IDENTITY:?}"
: "${STORAGE_ACCOUNT:?}" "${STORAGE_PHOTOS_CONTAINER:?}" "${STORAGE_IDENTITY:?}"
: "${VNET_NAME:?}" "${VNET_CIDR:?}" "${DNS_ZONE:?}"
: "${SUBNET_APPS:?}" "${SUBNET_APPS_CIDR:?}" "${SUBNET_DB:?}" "${SUBNET_DB_CIDR:?}"
: "${PG_SERVER:?}" "${PG_VERSION:?}" "${PG_TIER:?}" "${PG_SKU:?}" "${PG_STORAGE_GB:?}"
: "${PG_DB_NAME:?}" "${PG_ADMIN_USER:?}" "${PG_ADMIN_PASSWORD:?}"
: "${ENVIRONMENT:?}"

# --- 0. Confirm the target ---------------------------------------------
# The prod and staging env files differ by a handful of lines, and two of the
# resources below cannot be converted after creation. Name the target out loud
# and make someone agree to it before anything is created.
# Colour is the fastest way to notice the wrong target. Red is production,
# blue is anything else. Dropped entirely when output is not a terminal.
if [ -t 1 ]; then
  case "$ENVIRONMENT" in
    prod | production) BANNER=$'\033[1;97;41m' ;;
    *) BANNER=$'\033[1;97;44m' ;;
  esac
  BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  BANNER=""; BOLD=""; RESET=""
fi
ENV_UPPER="$(printf '%s' "$ENVIRONMENT" | tr '[:lower:]' '[:upper:]')"

printf '\n%s                                                  %s\n' "$BANNER" "$RESET"
printf '%s   PROVISIONING  ->  %-30s%s\n' "$BANNER" "$ENV_UPPER" "$RESET"
printf '%s                                                  %s\n\n' "$BANNER" "$RESET"
cat <<CONFIRM
  Config file      $ENV_FILE
  Subscription     $(az account show --query name -o tsv)
  Resource group   $RESOURCE_GROUP ($LOCATION)
  Apps environment $ACA_ENV
  Database         $PG_SERVER ($PG_SKU, ${PG_STORAGE_GB}GB)
  Blob storage     $STORAGE_ACCOUNT, via $STORAGE_IDENTITY

CONFIRM
printf '%sProvision to %s?%s [y/N] ' "$BOLD" "$ENV_UPPER" "$RESET"
read -r REPLY
case "$REPLY" in
  y | Y | yes | YES) ;;
  *) echo "aborted, nothing created." >&2; exit 1 ;;
esac

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
          Microsoft.DBforPostgreSQL Microsoft.OperationalInsights Microsoft.Network \
          Microsoft.Storage; do
  az provider register --namespace "$ns" --output none
done
for ns in Microsoft.App Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL Microsoft.Storage; do
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

# --- 3.1 Identity that pulls images -------------------------------------
# Both apps and the migration job authenticate to the registry with this one
# user-assigned identity rather than with a system-assigned one each. A
# system-assigned identity is born with the resource that holds it, so its
# AcrPull assignment is seconds old when the platform first validates the
# pull and the create fails; the migration job is deleted and recreated on
# every deploy, which made that a permanent race rather than a first-run
# cost. This identity outlives every resource that uses it. See
# docs/decisions.md 2026-09-13.
step "Pull identity $ACR_PULL_IDENTITY"
if ! exists az identity show -n "$ACR_PULL_IDENTITY" -g "$RESOURCE_GROUP" --query name -o tsv; then
  az identity create -n "$ACR_PULL_IDENTITY" -g "$RESOURCE_GROUP" \
    --location "$LOCATION" --output none
fi
ACR_ID="$(az acr show -n "$ACR_NAME" -g "$RESOURCE_GROUP" --query id -o tsv)"
IDENTITY_PRINCIPAL="$(az identity show -n "$ACR_PULL_IDENTITY" -g "$RESOURCE_GROUP" \
  --query principalId -o tsv)"
# Idempotent: the role assignment already existing is the normal case on a
# re-run, and az says so rather than failing.
az role assignment create --role AcrPull \
  --assignee-object-id "$IDENTITY_PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --scope "$ACR_ID" --output none 2>/dev/null || true

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

# A zone with no link to a VNet answers nobody, and this is not a gap step 6
# fills in. `flexible-server create --private-dns-zone` creates the link only
# when it also creates the zone; handed one that already exists — the path
# this script takes, because the zone is its own guarded step above — it
# registers the server's A record and stops there.
#
# The failure that follows is silent and very late: every resource looks
# correct, the record is present with the right private IP, and the first
# thing to connect from inside the VNet fails with NXDOMAIN. Staging hit
# exactly that on 2026-09-12, in the first job run of azure-db-roles.sh.
#
# Registration stays off: this zone holds one record that Azure writes itself,
# and auto-registering every VM in the VNet into it is not wanted.
DNS_LINK="link-$VNET_NAME"
step "Link $DNS_ZONE to $VNET_NAME"
if ! exists az network private-dns link vnet show -n "$DNS_LINK" -g "$RESOURCE_GROUP" \
     -z "$DNS_ZONE" --query name -o tsv; then
  az network private-dns link vnet create \
    --resource-group "$RESOURCE_GROUP" --name "$DNS_LINK" \
    --zone-name "$DNS_ZONE" --virtual-network "$VNET_NAME" \
    --registration-enabled false --output none
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
    --yes --output none
fi

# The application database is created separately. `flexible-server create`
# takes --database-name only for elastic clusters (az 2.90), and a single
# server is left with Azure's own defaults, none of which are this one.
# This runs over the management API, so it does not need VNet access.
#
# Only on a running server. Staging is stopped by default, and `db show` on a
# stopped server fails with ServerStoppedError, which `exists` reads as "no
# database" — so the script would try `db create`, which hangs until the
# gateway times out. Starting the server here instead would bill compute on
# every rerun and leave it running.
step "Database $PG_DB_NAME on $PG_SERVER"
PG_STATE="$(az postgres flexible-server show -n "$PG_SERVER" -g "$RESOURCE_GROUP" \
  --query state -o tsv)"
if [ "$PG_STATE" != "Ready" ]; then
  echo "  $PG_SERVER is $PG_STATE, skipped. If this server is new, start it and rerun."
elif ! exists az postgres flexible-server db show --name "$PG_DB_NAME" \
     --server-name "$PG_SERVER" -g "$RESOURCE_GROUP" --query name -o tsv; then
  az postgres flexible-server db create \
    --resource-group "$RESOURCE_GROUP" --server-name "$PG_SERVER" \
    --name "$PG_DB_NAME" --output none
fi

# --- 7. Blob storage ---------------------------------------------------
# Buddy photos. One account per environment: an account costs nothing until it
# holds data, so there is nothing to gain by sharing one.
#
# Shared-key auth is off, so the account keys Azure still generates cannot
# authorise a request. The only way in is Entra: the api uses
# $STORAGE_IDENTITY, which holds Storage Blob Data Contributor on this account
# and nothing else, so staging's api — in the same Container Apps environment
# as prod's — cannot touch prod's photos. It is user-assigned for the reason
# in 3.1: the role assignment is made here, once, instead of racing the first
# revision of the app that uses it. See docs/decisions.md 2026-09-13.
#
# The public endpoint stays on. Browsers fetch photos from it with short-lived
# SAS URLs; a private endpoint would break that and is billed. Anonymous
# access is off for the whole account, so no container can be made public.
step "Storage account $STORAGE_ACCOUNT"
if ! exists az storage account show -n "$STORAGE_ACCOUNT" -g "$RESOURCE_GROUP" --query name -o tsv; then
  az storage account create \
    --resource-group "$RESOURCE_GROUP" --name "$STORAGE_ACCOUNT" \
    --location "$LOCATION" --kind StorageV2 --sku Standard_LRS --access-tier Hot \
    --allow-shared-key-access false --allow-blob-public-access false \
    --min-tls-version TLS1_2 --https-only true \
    --output none
fi
# Unlike the environment's network type these are mutable, so a rerun enforces
# them on an account that already exists rather than trusting how it was made.
az storage account update \
  --resource-group "$RESOURCE_GROUP" --name "$STORAGE_ACCOUNT" \
  --allow-shared-key-access false --allow-blob-public-access false \
  --min-tls-version TLS1_2 --https-only true \
  --output none

# container-rm goes through the management API, so creating it needs no data
# role and works with shared-key auth off.
step "Container $STORAGE_PHOTOS_CONTAINER in $STORAGE_ACCOUNT"
if ! exists az storage container-rm show --storage-account "$STORAGE_ACCOUNT" \
     -g "$RESOURCE_GROUP" -n "$STORAGE_PHOTOS_CONTAINER" --query name -o tsv; then
  az storage container-rm create --storage-account "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" --name "$STORAGE_PHOTOS_CONTAINER" \
    --public-access off --output none
fi

# Scoped to the account, not the container: a user delegation SAS needs
# generateUserDelegationKey, which is granted only at account scope or above.
step "Blob identity $STORAGE_IDENTITY"
if ! exists az identity show -n "$STORAGE_IDENTITY" -g "$RESOURCE_GROUP" --query name -o tsv; then
  az identity create -n "$STORAGE_IDENTITY" -g "$RESOURCE_GROUP" \
    --location "$LOCATION" --output none
fi
STORAGE_ID="$(az storage account show -n "$STORAGE_ACCOUNT" -g "$RESOURCE_GROUP" --query id -o tsv)"
STORAGE_PRINCIPAL="$(az identity show -n "$STORAGE_IDENTITY" -g "$RESOURCE_GROUP" \
  --query principalId -o tsv)"
if ! exists az role assignment list --assignee "$STORAGE_PRINCIPAL" \
     --role "Storage Blob Data Contributor" --scope "$STORAGE_ID" --query '[0].id' -o tsv; then
  az role assignment create --role "Storage Blob Data Contributor" \
    --assignee-object-id "$STORAGE_PRINCIPAL" --assignee-principal-type ServicePrincipal \
    --scope "$STORAGE_ID" --output none
fi

step "Done"
cat <<SUMMARY

  Resource group   $RESOURCE_GROUP ($LOCATION)
  Registry         $(az acr show -n "$ACR_NAME" -g "$RESOURCE_GROUP" --query loginServer -o tsv)
  Apps environment $ACA_ENV
  Database         $PG_SERVER, private to $VNET_NAME
  Blob storage     $STORAGE_ACCOUNT/$STORAGE_PHOTOS_CONTAINER, reached as $STORAGE_IDENTITY

  Private hostname, as the server reports it:

    $(az postgres flexible-server show -n "$PG_SERVER" -g "$RESOURCE_GROUP" \
        --query fullyQualifiedDomainName -o tsv)

  Read it from the server; do not build it from PG_SERVER and DNS_ZONE. Azure
  names the A record in the private zone with a generated token rather than
  the server name, and publishes this CNAME onto it. The name resolves only
  inside the VNet, so it will not work from a laptop.

  Next: scripts/azure-db-roles.sh $ENV_FILE

  That creates the two restricted roles and prints the DATABASE_URL to deploy
  with. The admin account above is not it — see docs/deploy-plan.md 4.1.

SUMMARY
