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
post. It contains no delete or edit action.
