# TODOS — Paracelsus

## P1 — Ship blockers

### Suby.fi Credentials — Add to Vercel Env Vars (MANUAL — Nick)
**What:** Add `SUBY_API_KEY`, `SUBY_PRODUCT_ID`, `SUBY_WEBHOOK_SECRET` to Vercel. Create $17 L1 exam product in Suby.fi dashboard. Set webhook URL to `https://paracelsus.live/api/webhooks/suby`.
**Why:** Payment integration code is complete but the $17 button returns "Payment service not configured" without credentials.
**Effort:** XS (~5 min, manual in Suby.fi + Vercel dashboards)

### Custom Domain — Update Google OAuth Origins (MANUAL — Nick)
**What:** Add `paracelsus.live` to Google Cloud Console OAuth credentials.
**Why:** Google OAuth will reject sign-in requests from the new domain until added.
**Context:** Domain `paracelsus.live` is live on Vercel. Supabase auth already updated. Google Console still only has `paracelsius.vercel.app`.
**Add to Authorized JavaScript Origins:** `https://paracelsus.live`
**Add to Authorized Redirect URIs:** `https://paracelsus.live/api/auth/callback`
**Where:** Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
**Effort:** XS (~2 min, manual in Google Console)

### Chat History Loading on Mount
**What:** When SpiritChat mounts on /profile, fetch last 15 messages from the messages table and display them so users see their conversation after page refresh.
**Why:** Chat appears blank on every page load even though conversation exists in DB. LLM has context (last 15 messages loaded server-side) but user sees empty chat.
**Context:** Profile page is now the main product page with chat. Blank chat on refresh is confusing. Need a GET endpoint or direct Supabase client query to fetch messages on mount.
**Depends on:** Profile restructure (done).
**Effort:** S (human: ~2 hrs / CC: ~10 min)


## P2 — Post-MVP

### Coinbase Wallet Auth
**What:** Add WalletConnect/Coinbase Wallet SDK for wallet-based auth alongside Google OAuth.
**Why:** Crypto-native users (Base ecosystem). Unique positioning. Aligns with Open Claw Phase 2.
**Context:** CEO plan accepted wallet auth but eng review deferred it. Google OAuth covers 95%+ of users. Needs: @coinbase/wallet-sdk or wagmi, server-side signature verification, custom JWT minting.
**Depends on:** Google OAuth working first.
**Effort:** M (human: ~4 days / CC: ~30 min)

### Sound Design
**What:** Subtle CRT hum, static crackle on glitch phases, typewriter clicks on EtherText reveal.
**Why:** Audio reinforces the spirit-summoning atmosphere. Toggle-able (off by default on mobile).
**Context:** No audio in the app currently. Would use Web Audio API.
**Effort:** M (human: ~3 days / CC: ~20 min)

### Daily Return Ritual
**What:** Paracelsus initiates conversation each day with an observation, not a blank chat.
**Why:** Creates habit loop. "You slept poorly. I can see it." vs blank screen.
**Context:** Requires server-side daily trigger or smart prompt engineering to check last interaction time.
**Effort:** S (human: ~2 days / CC: ~15 min)

### Ambient Particle Density
**What:** Ember particle count/intensity tied to lifespan — more years lost = more embers.
**Why:** Subtle environmental storytelling. Users notice without being told.
**Context:** EmberParticles.tsx currently uses fixed 12 particles.
**Effort:** S (human: ~2 hrs / CC: ~5 min)

## Completed

### Suby.fi Payment Integration — v0.1.0.0 (2026-03-21)
$17 one-time L1 exam purchase. Subscribe endpoint with double-pay protection. Webhook sets `exam_purchased = true`. Payment redirect handling.

### Message Counter Live Update — v0.1.0.0 (2026-03-21)
`localUsed` state increments instantly on send. `useSubscription` now has refresh.
