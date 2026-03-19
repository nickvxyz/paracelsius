# TODOS — Paracelsus

## P1 — Ship blockers

### Suby.fi Payment Integration
**What:** Wire Suby.fi checkout URL and webhook for $30/mo subscriptions.
**Why:** No revenue without payments. Narrative paywall is built but subscribe button goes nowhere.
**Context:** PaywallModal and narrative paywall both have stub links (href='#'). Subscription status tracking already works in DB. Need API credentials from Nick.
**Depends on:** Suby.fi account setup and API links.
**Effort:** S (human: ~4 hrs / CC: ~15 min)

### Custom Domain — Update Google OAuth Origins
**What:** When a custom domain is added, update Google Cloud Console OAuth credentials to include the new domain in both Authorized JavaScript Origins and Authorized Redirect URIs.
**Why:** Google OAuth will reject requests from origins not in the allowlist.
**Context:** Currently only `https://paracelsius.vercel.app` is authorized. Add the custom domain as a second entry in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID.
**Depends on:** Custom domain purchase and DNS setup.
**Effort:** XS (~2 min, manual in Google Console)

### Chat History Loading on Mount
**What:** When SpiritChat mounts on /profile, fetch last 15 messages from the messages table and display them so users see their conversation after page refresh.
**Why:** Chat appears blank on every page load even though conversation exists in DB. LLM has context (last 15 messages loaded server-side) but user sees empty chat.
**Context:** Profile page is now the main product page with chat. Blank chat on refresh is confusing. Need a GET endpoint or direct Supabase client query to fetch messages on mount.
**Depends on:** Profile restructure (done).
**Effort:** S (human: ~2 hrs / CC: ~10 min)

### Message Counter Live Update
**What:** Refresh the free message counter in SpiritChat after each send so it decrements in real-time without page reload.
**Why:** Currently subscription data is loaded once on mount. Counter stays stale until refresh.
**Context:** SpiritChat derives `remaining` from props passed at mount. Need to either re-fetch subscription after each send or track count locally.
**Effort:** XS (human: ~1 hr / CC: ~5 min)

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
