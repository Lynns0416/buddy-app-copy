# The nightly backup job's image. Built by scripts/azure-backup.sh with
# `az acr build`, from this directory as its context — deliberately not the
# repo root, which would upload scripts/azure.env to the registry.
#
# postgres:16, not :18, and not the api image:
#   - the api image has no pg_dump, which is why this is a separate job at all
#     (docs/deploy-plan.md §9)
#   - the server is PG_VERSION=16, and a dump taken by pg_dump 18 emits SET
#     transaction_timeout, which a 16 server rejects on restore —
#     scripts/azure-db-restore.sh has to filter it out line by line. Matching
#     the server's major version means the dump loads into it unedited, which
#     is the only property that matters for a backup.
FROM postgres:16

# curl to reach the Blob REST API and the Container Apps identity endpoint,
# jq to read the token out of its response. postgres:16 carries none of the
# three — checked, not assumed. This layer adds ~3 MB to the base image's
# ~160 MB. Installed at build time on purpose: a nightly `apt-get install`
# would make every backup depend on a Debian mirror being up.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl jq \
  && rm -rf /var/lib/apt/lists/*

# Both halves, in one image: the check has to speak the same Blob API and the
# same psql as the dump did, and an image that only ever wrote backups would
# be one nobody had proved could read them.
COPY backup.sh verify.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/backup.sh /usr/local/bin/verify.sh

# The base image's entrypoint initialises a database server. Drop it. The
# nightly job takes this default; scripts/azure-backup-verify.sh overrides
# the command with verify.sh.
ENTRYPOINT ["/usr/local/bin/backup.sh"]
