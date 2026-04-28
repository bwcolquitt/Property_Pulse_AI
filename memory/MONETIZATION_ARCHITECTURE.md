# PropertyPulse — Monetization Architecture

> One-page reference for founders, investors, and the engineering team.
> Last updated: April 2026

---

## TL;DR

PropertyPulse is a **multi-tenant B2B SaaS** for short-term rental property managers. Revenue comes from two streams (one launched, one optional/future):

| Stream | Status | Who pays | Pricing | Net margin |
|---|---|---|---|---|
| **1. Host SaaS Subscriptions** | ✅ Launching | Property managers | $29 / $79 / $199 per month | ~96% (web), ~70-85% (mobile) |
| **2. Direct-Booking Platform Fee** | 🟡 Future (optional) | Hosts (auto-deducted) | 5% of each guest booking | ~92% per booking |

Guests/renters **never pay PropertyPulse anything** — they use the app for free.

---

## Stream 1: Host Subscription (Live)

### Plan Tiers

| Plan | Price | Properties | Team | Key features |
|---|---|---|---|---|
| **Starter** | $29/mo | 5 | 3 | Turnovers, checklists, iCal sync, email |
| **Professional** | $79/mo | 15 | 10 | + SMS, AI, PMS integrations, scorecards |
| **Enterprise** | $199/mo | Unlimited | Unlimited | + White-label, API, custom subdomain |

All plans include a **14-day free trial** (card upfront, charged on day 15).

### Where Hosts Sign Up

| Channel | Payment processor | Fee | Net to PropertyPulse |
|---|---|---|---|
| 🌐 propertypulse.com (web) | **Stripe Billing** | 0.7% + 2.9% + $0.30 ≈ 3.6% | **~96%** |
| 📱 iOS app (App Store) | **Apple In-App Purchase via RevenueCat** | 15-30% Apple + 1% RevenueCat (above $2.5K MTR) | ~70-85% |
| 📱 Android app (Play Store) | **Google Play Billing via RevenueCat** | 15-30% Google + 1% RevenueCat | ~70-85% |

**Strategy:** Drive 80%+ of signups to the web via marketing (content, SEO, demo calls, partner referrals). Mobile signup is offered for compliance + casual discovery only.

### Mobile-vs-Web Pricing Trick

To absorb Apple/Google's cut without losing margin, we publish **higher prices in-app**:

| Plan | Web price (Stripe) | App Store price (IAP) | Net we receive (web) | Net we receive (app) |
|---|---|---|---|---|
| Starter | $29 | $39 | ~$28 | ~$28-33 |
| Pro | $79 | $99 | ~$76 | ~$70-84 |
| Enterprise | $199 | $249 | ~$192 | ~$176-211 |

This is what Spotify, Tinder, and most major SaaS apps do. The web is always advertised as "best price." Apple/Google forbid us from saying so *inside* the app, but our website, emails, and sales calls have no such restriction.

---

## Stream 2: Direct-Booking Platform Fee (Future)

PropertyPulse already has a `guest-book.tsx` screen and a guest portal. Today, those are read-only/communication features. The next step would be enabling **payment-enabled direct bookings**, where guests book a stay and pay directly through PropertyPulse, bypassing VRBO/Airbnb fees (typically 8-15%).

### How It Works (Stripe Connect)

```
Guest pays $1,200 for 3 nights via PropertyPulse guest portal
   ↓
Stripe Connect splits the payment:
   • $1,140  → Host's connected Stripe account (95%)
   • $60     → PropertyPulse main account (5% platform fee)
   • $35     → Stripe processing fees (2.9% + $0.30 per txn)

Net to PropertyPulse per booking: ~$25
Apple/Google tax: $0 (real-world lodging service is exempt from IAP)
```

### Why This Is Powerful

- **Hosts save** ~3-10% vs VRBO/Airbnb
- **PropertyPulse adds** a recurring per-booking revenue stream on top of subscription
- **No App Store cut** because lodging is a real-world service (same exemption as Uber, Airbnb, DoorDash)
- **Compliance:** Stripe Connect handles 1099 forms, tax reporting, dispute resolution

### Required to Build
- Stripe Connect Express onboarding (host signs up for a Stripe sub-account in 5 min)
- Booking flow: availability → quote → checkout → confirmation
- Refund/cancellation policies
- Pre-authorization for security deposits
- Estimated effort: 2-3 weeks of engineering

---

## Why Guests Pay Nothing

PropertyPulse follows the **Airbnb / Uber / Hostfully model**:

| Stakeholder | Pays | Receives |
|---|---|---|
| Host (property manager) | Monthly SaaS subscription + 5% per booking (future) | Tools to manage properties + guests + a direct-booking channel |
| Guest (renter) | $0 | Free guest portal: AI concierge, property guide, check-in info, messaging, direct booking option |

Guest "value" is what attracts them to download the app, which makes the app sticky and grows the host's value (more direct bookings = more host stickiness = lower churn).

---

## App Store Compliance Cheatsheet

| Question | Answer |
|---|---|
| Do guests need to pay anything in the app? | No → no IAP required → no Apple/Google cut |
| Do hosts need an in-app subscription option? | Yes (if app is on App Store) → must offer Apple IAP at parity or higher pricing |
| Can we link to web pricing from inside the app? | iOS: limited (one external link allowed since 2024). Android: yes after 2024 court rulings |
| Are direct guest bookings subject to IAP? | No — real-world service exemption (lodging, like Airbnb/Uber) |
| What about future features like "AI add-on $5/mo"? | If consumed in-app → IAP required. If unlocked via web purchase → optional |

---

## Engineering Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  PROPERTYPULSE BACKEND (FastAPI + MongoDB)                  │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Stripe Billing  │  │  RevenueCat     │  │  Stripe     │ │
│  │ (web subs)      │  │  (mobile subs)  │  │  Connect    │ │
│  │                 │  │                 │  │  (bookings) │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │                    │                  │        │
│           └──────┬─────────────┴──────────────────┘        │
│                  ↓                                         │
│         ┌────────────────────┐                             │
│         │  tenants collection │                             │
│         │  - plan: pro        │  ← unified subscription    │
│         │  - status: active   │     status, regardless of  │
│         │  - source: stripe   │     payment channel        │
│         └────────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

All three integrations write to the **same `tenants` collection** in MongoDB. Webhooks from Stripe + RevenueCat keep the `status` field in sync. The frontend doesn't care which payment method was used — it just checks `tenant.plan` to gate features via the `useFeature()` hook.

---

## Cost Projections

### Year 1 (web-only, conservative)
- **100 paying hosts**, mix: 30 Starter / 50 Pro / 20 Enterprise
- **MRR:** $30×29 + 50×79 + 20×199 = $870 + $3,950 + $3,980 = **$8,800/mo** = **$105K ARR**
- **Stripe fees:** ~$320/mo (3.6%)
- **Net revenue:** ~$8,480/mo (~$102K ARR)
- **Infra costs:** ~$200/mo (Emergent + MongoDB Atlas + Stripe + email/SMS)
- **Gross margin:** ~95%

### Year 2 (mobile + direct booking added)
- **500 paying hosts**, MRR ~$45K
- **Direct bookings:** ~2,000/mo at avg $800 = $1.6M GMV → **$80K platform fees**
- **Combined ARR:** ~$1.4M
- **Effective take rate after all fees:** ~88% on web subs, ~85% on mobile subs, ~92% on bookings
- **Net annual revenue:** ~$1.2M

---

## Open Questions / Decisions Pending

- [ ] Apply for D&B number to enable Apple/Google org developer accounts (in progress)
- [ ] Stripe live keys provisioning (test keys ready)
- [ ] Decide: bundle direct-booking under existing Pro/Enterprise tiers, or charge a separate platform fee?
- [ ] Annual billing discount? (industry standard: 2 months free → effective 17% discount)
- [ ] Volume discounts for property managers > 50 properties?
