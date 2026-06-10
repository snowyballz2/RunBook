---
title: Ship a Static Site
subtitle: Example guide — build, configure, and deploy a site cleanly
accent: violet
---

> [!NOTE]
> This is an example guide that ships with RunBook to show the format. Use it, edit it, or remove it — your real guides work the same way.

## Phase 1 — Build it clean

### Produce a production build
Run the production build and confirm it finishes without warnings. Warnings now are bugs later.

```bash
npm ci
npm run build
```

### Check the output locally
Never deploy a build you haven't looked at. Serve the output and click through the critical paths.

```bash
npm run preview
```

> [!TIP]
> Test the build, not the dev server. Minification, base paths, and asset hashing only happen in the real build — that's exactly where the surprises live.

## Phase 2 — Configure

### Set the environment variables
Production needs its own values — never reuse development secrets. Set them in your host's dashboard, not in the repo.

> [!DANGER]
> Do not commit `.env` files with real secrets. If you already did, rotate those keys now — git history is forever, and crawlers find committed keys within minutes.

### Pin the runtime
Lock the build to a specific runtime version so a host upgrade can't silently change your output.

```bash
node --version > .nvmrc
```

## Phase 3 — Deploy

### Push to production
Trigger the deploy. With a static host this is usually a push to the production branch or a single CLI command.

```bash
git push origin main
```

> [!NOTE]
> The first deploy of a new domain can take a few minutes while certificates are issued. A blank page or a TLS warning right after deploy is usually just propagation — wait before you panic.

### Point DNS at the host
Add the records your host gives you. Lower the TTL *before* a planned cutover so changes propagate fast.

## Phase 4 — Verify

### Walk the live site
Open the production URL in a clean browser profile and walk the same critical paths you checked locally.

- Load the homepage and one deep link directly (catches base-path bugs)
- Confirm assets and fonts load over HTTPS with no mixed-content warnings
- Check it on a phone, not just a desktop window

### Watch for the first errors
Tail your host's logs or error reporting for a few minutes after going live. The cheapest bug to fix is the one you catch before anyone reports it.

> [!TIP]
> Take ten seconds to run the live URL through Lighthouse. A red performance score on day one is far easier to fix than after three months of "just one more feature".
