# Concept: licenses and school customers

Status: November 2026. Draft.

Goal: offer Notenfeder as a paid PWA for individual teachers, schools and school authorities.
The operator still can never read the data.

The basis is today's state: account, end-to-end encryption and sync for a single user. The
interface is described in [protocol.md](protocol.md), operation in
[server/README.md](../server/README.md). This document only covers what is still missing.

Statements about law, providers and services are given to the best of knowledge. Check them
before every decision.

## 1. Decisions

| Topic | Decision |
|---|---|
| Platform | Stays a PWA. No app store for now. |
| Customers | Individual teachers, schools, school authorities (municipality/district). Federal states later. |
| Sign-in for schools | Microsoft (school tenant), VIDIS (state accounts), Google Workspace, later IServ and state platforms. |
| Sign-in for individual customers | As today: passkey, personal Microsoft or Google account. |
| Master key | Per school. Only the public key is on the server. |

## 2. Customers and licenses

### Data model (addition to the server)

```
customers   id, type ('org' | 'person'), name, status, paidUntil
orgLogins   customerId, provider, orgId              -- only for 'org'
schools     id, customerId, name, publicMasterKey    -- one org can have many schools
users       + customerId?, schoolId?                 -- new columns
```

### Check at sign-in

1. Do `provider` and `orgId` match an active org customer? Then access is granted.
2. Otherwise: does the user have an active own license? Then access is granted.
3. Otherwise: the app shows the payment page.

When a teacher's school becomes a customer later, the own license ends.

Today the operator approves new accounts by hand (`approved`, see protocol.md 2). The license
check replaces this manual approval.

Open: today an account has exactly one sign-in method. Teachers who move from an own license
to a school license need a way to keep their account (e.g. link the school sign-in
additionally).

## 3. Sign-in for schools

| Provider | Attribute for the customer check | Change from today |
|---|---|---|
| Microsoft Entra ID | `tid` (tenant id), if needed group or domain per school | Today only tenant `consumers`. For schools additionally tenant `organizations` with a `tid` check. |
| VIDIS | School id | New. |
| Google Workspace for Education | `hd` (domain) | Today personal accounts. For schools check `hd`. |
| IServ, state platforms | Issuer URL | New, if needed. |

Notes:

- Many German schools do not use Microsoft 365. Microsoft alone is not enough.
- Microsoft: multi-tenant app, publisher verification (free partner account). Many school
  tenants need consent by the school IT ("admin consent").
- A school authority's tenant can contain many schools. The tenant id alone does not tell them
  apart.
- VIDIS: admission as an offering with a data protection review. Contact the FWU early. Not
  every state is connected.

## 4. Master key of the school

- The school creates a key pair (X25519 or RSA-OAEP). The private key stays offline with the
  school management or administration.
- The app additionally wraps each teacher's data key with the public key of their school. The
  wrap kind `org` is already reserved in the server, but still rejected.
- The key belongs to the **school**, not to the tenant.
- A tool for the school is needed: create the key, store the public part, decrypt a teacher's
  data in an emergency.
- Teachers must know that the school can decrypt (privacy policy, onboarding).
- Individual customers have no master key.

## 5. Payment

- **Org customers**: contract and invoice per school or school authority. The operator sets
  `status` and `paidUntil` by hand.
- **Individual customers**: subscription via a merchant of record (Paddle or Lemon Squeezy). It
  pays the VAT and issues the invoices. Costs about 5 % + $0.50 per payment. Alternative:
  Stripe is cheaper, but VAT and invoices are then the operator's job.
- A webhook sets `status` and `paidUntil`.
- As a PWA there is no store commission.

## 6. Operation for customers

The Raspberry Pi with Tailscale Funnel is enough for own use, not for customers.

| Item | Choice | Cost |
|---|---|---|
| Server | Hetzner (EU), smallest ARM VM, the existing Docker image | approx. €4–5/month |
| Database | SQLite as today; Postgres only with many schools (store interface exists) | €0 |
| Photos | File system of the VM as today, later S3-compatible (Hetzner Object Storage) | small |
| Domain | own domain for app and server | approx. €10/year |
| PWA hosting | Cloudflare Pages as today | €0 |
| **Total** | | **approx. €60–70/year** plus fees per payment |

**Important before the first customer:** passkeys are bound to the RP ID (today
`tablegrade.pages.dev`). Moving to an own domain invalidates all passkeys. Existing accounts
then have to sign in once with the recovery key and create a new passkey. So fix the domain
before other users join.

## 7. Law and data protection

- Grades of minors need special protection.
- The **school** is the controller. The operator is a **processor**.
- **DPA** (Art. 28 GDPR, German "AVV") with every school or school authority. For individual
  customers a standard DPA to download.
- Encrypted data mostly still counts as personal data. E2EE lowers the risk but does not
  replace the GDPR duties.
- Documents for schools: technical and organizational measures (TOM), material for the data
  protection impact assessment, deletion concept, reporting path for data breaches.
- Private devices need approval of the school management in many states. Point this out in the
  onboarding.
- Individual customers are consumers: terms and conditions, cancellation policy, prices
  including VAT.
- Legal notice (Impressum) and privacy policy.
- With revenue: register a business, check the small business regulation
  (Kleinunternehmerregelung).
- Server location in the EU. US providers make talks with schools harder.
- Check the terms of use of mehr-schulferien.de for commercial use.

## 8. Trust and known limits

- The operator ships the code. A manipulated update could steal keys. Countermeasures: open
  source, reproducible builds.
- Conflicts: last write wins per record. Two devices working offline for a long time overwrite
  each other. After restoring a server backup, later deletions come back. With several users
  per school, real conflict handling may become necessary.

## 9. Roadmap

### Phase 1: basis for customers

- [ ] Fix an own domain, change the RP ID, create existing passkeys again.
- [ ] Move the server to Hetzner (same image), adjust the backup target.
- [ ] Tables `customers`, `orgLogins`, `schools`, columns in `users`.
- [ ] Check at sign-in and a lock page without a license.

### Phase 2: individual customers

- [ ] Merchant of record with webhook, payment page in the app.
- [ ] Terms and conditions, cancellation policy, legal notice, privacy policy, standard DPA.

### Phase 3: schools via Microsoft

- [ ] Multi-tenant app in Entra ID, publisher verification, tenant `organizations`.
- [ ] Assignment teacher → school.
- [ ] Master key: wrap kind `org`, tool for the school.
- [ ] Documents for schools: DPA, TOM, material for the impact assessment.
- [ ] First pilot school.

### Phase 4: further providers

- [ ] Connect VIDIS (contact the FWU, data protection review).
- [ ] Google Workspace for Education (`hd`).
- [ ] If needed, IServ and state platforms.

### Later

- [ ] Contracts with federal states.
- [ ] App store (Capacitor). Check first: SQLocal needs OPFS and COOP/COEP, the iOS WebView
      probably needs a native SQLite plugin. Apple requires account deletion in the app,
      privacy labels and usually "Sign in with Apple".

## 10. Open questions

- Price per teacher and per school.
- Who supports the key ceremony at the school (guide, tool)?
- How long is data kept after a contract ends?
- Open source or not?
- How does a teacher move from an own license to a school license (keep the account)?
