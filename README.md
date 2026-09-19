# Bluebrook landing

Static landing page for Witnessed at [bluebrook.co](https://bluebrook.co/).

The site is deployed by Cloudflare from `main`. Keep product claims aligned
with the live App Store build and use aggregate App Store campaign parameters
on acquisition links.

## Social campaigns

The 2026 NFL kickoff campaign is defined in
`marketing/nfl-2026-kickoff-campaign.json`. Regenerate its committed PNGs with:

```bash
node scripts/render-nfl-2026-campaign.js
```

Preview the validated Buffer schedule without making external changes:

```bash
node scripts/schedule-nfl-2026-campaign.js --action=preview
```

The scheduler requires `WITNESSED_BUFFER_KEY` at runtime. It performs channel,
media, queue-collision, duplicate, copy, and schedule checks before creating any
post. Scheduling is future-only and idempotent: expired manifest entries are
ignored, an exact scheduled record is reused, and a conflicting record fails
closed. It contains no delete or edit action.

Validate the live future queue without creating anything:

```bash
node scripts/schedule-nfl-2026-campaign.js --action=queue-verify
```

## Acquisition links and legal routes

Landing-page App Store buttons use first-party `/download/hero` and
`/download/final` redirect hops. The page forwards only sanitized aggregate UTM
labels and a CTA placement; it does not store cookies or forward arbitrary query
parameters. These redirect requests can be measured in Cloudflare traffic logs.
Apple campaign attribution still requires the numeric provider token from an App
Store Connect-generated campaign link; do not invent or infer that token.

`/privacy` and `/terms` are stable first-party URLs that temporarily redirect to
the canonical legal documents served by the production backend. A Cloudflare
Pages Function owns the legal and download redirects so arbitrary inbound query
parameters are dropped. Download destinations reconstruct only sanitized UTM
labels plus a trusted `hero` or `final` CTA placement; legal destinations carry
no query string at all.
