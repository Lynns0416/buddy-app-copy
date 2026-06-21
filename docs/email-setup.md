# Email setup (Gmail API via service account)

One-time setup so the notification system can send email through your Google
Workspace for Nonprofits domain. Auth reuses the **existing Firebase service
account** — no new credentials to manage.

The mechanism is **domain-wide delegation**: the service account is authorized
to impersonate a specific mailbox in your Workspace and send mail on its behalf
through the Gmail API.

## 1. GCP — find the service account's client ID

[GCP Console](https://console.cloud.google.com/) → **IAM & Admin** → **Service Accounts**
→ click the Firebase service account (usually named
`firebase-adminsdk-xxxxx@<project>.iam.gserviceaccount.com`).

On the details page there are two relevant sections:

- **Domain-wide delegation** — this is where the Client ID lives. Copy the
  long numeric **Client ID** (looks like `103456789012345678901`). That's the
  OAuth 2 client ID we need — Google's UI just dropped the "OAuth 2" prefix
  in the newer console.
- *Google Workspace Marketplace OAuth2 Client* — ignore. Different mechanism.

> Save that Client ID. You'll paste it in step 3.

## 2. GCP — enable the Gmail API on the project

[GCP Console](https://console.cloud.google.com/) → **APIs & Services** →
**Library** → search "Gmail API" → **Enable**.

One-time, per GCP project.

## 3. Workspace — authorize the service account

You must be a **Workspace super admin** for this step.

[admin.google.com](https://admin.google.com/) → **Security** → **Access and
data control** → **API controls** → at the bottom of that page, click
**MANAGE DOMAIN WIDE DELEGATION**.

Click **Add new** and fill in:

| Field | Value |
|---|---|
| **Client ID** | The numeric Client ID from step 1 |
| **OAuth scopes** | `https://www.googleapis.com/auth/gmail.send` |

Save. Propagation usually finishes in a minute or two but can take longer.

## 4. Workspace — pick or create the sender mailbox

The address you set in `GMAIL_SENDER` must be a **real Workspace user** in your
domain (not an alias, not a group). The "From:" header recipients see will be
exactly this address; replies route to that mailbox.

Any local-part works: `noreply@`, `hello@`, `team-dev@`, etc. To create a new
one:

Workspace admin → **Directory** → **Users** → **Add new user** → fill in name
and address. The password is never used in practice — we sign in as that
mailbox via service account impersonation.

If you want replies to land in a different inbox than the From: address,
that's a future enhancement (a Reply-To header on outgoing mail). Not wired in
the current build.

## 5. Set env vars

In `apps/api/.env` (and the same in any deploy environment):

```env
# Reuse the Firebase service account credentials
FIREBASE_CLIENT_EMAIL="<service-account-email-from-the-JSON-key>"
FIREBASE_PRIVATE_KEY="<private-key-from-the-JSON-key>"

# Email-specific
GMAIL_SENDER="team-dev@your-domain"
EMAIL_DISABLED=false
WEB_BASE_URL="http://localhost:3000"     # or your prod URL, no trailing slash
```

`FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` come from the service
account JSON key: GCP Console → IAM & Admin → Service Accounts → your Firebase
service account → **Keys** tab → **Add Key → Create new key (JSON)**. The JSON
file gives you `client_email` and `private_key` (the whole
`-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----\n` blob, newlines
included — keep them as `\n` escape sequences in the env value, the code
unescapes).

For **dev** without real credentials yet, set:

```env
EMAIL_DISABLED=true
```

…and the dispatcher will log instead of sending. The queue mechanics still work,
so you can develop everything else.

## 6. Test end-to-end

> This repo's local docker setup uses the legacy `docker-compose` binary, not
> the `docker compose` plugin — `docker compose` errors with `unknown
> command`. Use `docker-compose` throughout.

> **`.env` doesn't auto-pick-up new keys.** When a feature branch adds new
> vars to `.env.example` (like this one did for `GMAIL_SENDER`/
> `EMAIL_DISABLED`/`WEB_BASE_URL`), your local `apps/api/.env` won't have them
> until you copy them over by hand — `.env` is gitignored and never diffed
> against the example. Diff the two before assuming env is current:
> `diff <(grep -o '^[A-Z_]*=' apps/api/.env.example) <(grep -o '^[A-Z_]*=' apps/api/.env)`.

> **`docker-compose restart` does not reload `env_file` changes.** It restarts
> the existing container with the env it was *created* with. After editing
> `.env`, recreate the container instead: `docker-compose up -d api`.

1. Update `apps/api/.env` if needed (see notes above), then:
   `docker-compose up -d api`
2. Trigger something that enqueues a buddy email — e.g. an admin approves a
   pending buddy. Account approval is the smallest end-to-end test.

   To skip the UI flow, insert a job directly (swap in a real user id/email
   from your `User` table):
   ```bash
   docker-compose exec -T db psql -U peacebuddy -d peacebuddy -c "
   insert into \"NotificationJob\"
     (id, channel, \"eventType\", \"recipientUserId\", payload, locale, status, attempts, \"scheduledFor\", \"createdAt\", \"updatedAt\")
   values
     (gen_random_uuid(), 'email', 'account_approved', '<user-id>', '{}', 'ja', 'pending', 0, now(), now(), now());
   "
   ```
3. Confirm rows landed in the queue:
   ```bash
   docker-compose exec -T db psql -U peacebuddy -d peacebuddy \
     -c 'select id, channel, "eventType", status, attempts, "lastError" from "NotificationJob" order by "createdAt" desc limit 5;'
   ```
   Expect one `in_app` and one `email` row (or just the `email` row if you
   inserted manually), `status=pending`.
4. Dispatch:
   ```bash
   curl -X POST http://localhost:8080/jobs/notifications/dispatch \
     -H "X-Scheduler-Secret: local-secret"
   ```
   Expect `{"picked":1,"sent":1,"failed":0,"dead":0,"skipped":0}` (counts
   depend on how many jobs were queued).
5. Sanity-check it was a **real** send, not the `EMAIL_DISABLED=true` log-only
   path: `docker-compose logs api --tail 20`. A real send has no
   `[email:disabled]` line and the dispatch call takes ~1s (Gmail API round
   trip) instead of single-digit ms. Then confirm the email actually arrived
   in the recipient's inbox — the DB/log signals alone don't prove delivery.
6. If a job is stuck `pending` with a `lastError` from a previous failure, its
   `scheduledFor` is pushed out by backoff (1m/5m/30m/2h/6h by attempt). To
   retry immediately instead of waiting:
   ```bash
   docker-compose exec -T db psql -U peacebuddy -d peacebuddy \
     -c "update \"NotificationJob\" set \"scheduledFor\" = now() where id = '<job-id>';"
   ```

## Common failures and what they mean

| Symptom | Cause |
|---|---|
| `unauthorized_client` / "Client is unauthorized to retrieve access tokens" | Step 3 hasn't propagated yet; OR scope string is wrong (must be the full URL); OR you pasted the service account *email* instead of the numeric *Client ID*. |
| "Precondition check failed" / "Mail service not enabled" | The `GMAIL_SENDER` user doesn't have Gmail enabled. Workspace admin → Apps → check Gmail is on for that user. |
| `Delegation denied for ...` | The service account is trying to impersonate a domain you don't control. The `GMAIL_SENDER` mailbox must exist in your Workspace domain. |
| 403 from the send call | Gmail API not enabled (step 2). |
| `picked: 0` from dispatch curl, but you expected jobs | No events have fired yet, OR jobs were already dispatched. Verify with the psql query in step 6. |
| Email job goes to `failed` then `dead` with `DECODER routines::unsupported` or `invalid_grant` | `FIREBASE_PRIVATE_KEY` is missing, malformed, or still set to a placeholder. |

## Production checklist

- [ ] Steps 1–3 done in the **prod** GCP project / Workspace (separate from dev if applicable)
- [ ] `GMAIL_SENDER` set to the chosen mailbox
- [ ] `EMAIL_DISABLED=false` (or unset)
- [ ] `WEB_BASE_URL` set to the public URL, no trailing slash
- [ ] `FIREBASE_PRIVATE_KEY` / `FIREBASE_CLIENT_EMAIL` set from a prod service account key
- [ ] Sender mailbox has Gmail enabled
- [ ] Sent a test approval email and confirmed delivery
