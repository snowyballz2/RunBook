# Deploying Runbook to GitHub Pages

Runbook is a static client-side app, so hosting is just "serve the `dist/`
folder over HTTPS." A GitHub Actions workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
builds on every push to `main` and publishes to GitHub Pages.

Two things that make this painless here:

- **Hash routing** (`#/g/...`) means no SPA 404-fallback trick is needed — deep
  links and reloads always resolve to the app shell.
- The workflow injects the correct **base path** automatically, so assets, the
  manifest, icons, and the service worker all resolve under the project subpath.

## One-time setup

```bash
# 1. Create the repo on GitHub (UI or, if you install the gh CLI):
#    gh repo create RunBook --public --source=. --remote=origin --push
#
#    …or manually:
git remote add origin https://github.com/<you>/RunBook.git
git push -u origin main
```

Then in the repo on github.com: **Settings → Pages → Build and deployment →
Source: “GitHub Actions.”** That's it — the next push (or re-running the
workflow) builds and deploys.

Your site will be at:

```
https://<you>.github.io/RunBook/
```

The first deploy takes a couple of minutes; the workflow's summary links the live URL.

## How the base path is chosen

The build reads `BASE_PATH`. The workflow sets it for you:

| Where it's hosted | BASE_PATH | Result |
|---|---|---|
| Project site (`<you>.github.io/RunBook/`) | `/RunBook/` (auto) | served under `/RunBook/` |
| User/org site (repo named `<you>.github.io`) | `/` (auto) | served at root |
| Custom domain | set repo **variable** `BASE_PATH=/` | served at root |

For a custom domain: add the domain in Settings → Pages (it writes a `CNAME`),
set the repo variable `BASE_PATH` to `/` (Settings → Secrets and variables →
Actions → Variables), and add a `public/CNAME` file containing your domain so it
survives each deploy.

## HTTPS & security

- **HTTPS is automatic.** Check *Settings → Pages → Enforce HTTPS*. Service
  workers (and therefore install/offline) require HTTPS, which you get for free.
- **Caveat — GitHub Pages cannot set custom response headers.** You can't add a
  `Content-Security-Policy` or other custom headers (that's a Netlify/Cloudflare
  feature). For a static, server-less app this is an acceptable posture: there's
  no backend or database, and Runbook already sanitizes rendered Markdown
  ([parseGuide.ts](src/lib/parseGuide.ts)) so a pasted guide can't inject scripts.
- If you later want a strict CSP, a WAF, or custom headers, front the Pages site
  with **Cloudflare** (free) or deploy the same `dist/` to **Cloudflare Pages /
  Netlify** instead — no code changes needed.

## Local equivalents

```bash
npm run build                 # builds for root (base "/")
BASE_PATH=/RunBook/ npm run build   # reproduce the Pages project-site build
npm run preview               # serve the build locally
```
