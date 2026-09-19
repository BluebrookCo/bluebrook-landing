const APP_STORE_URL = 'https://apps.apple.com/app/id6781100911';
const LEGAL_URLS = {
  '/privacy': 'https://seenlive-production.up.railway.app/privacy',
  '/terms': 'https://seenlive-production.up.railway.app/terms',
};
const DOWNLOAD_PLACEMENTS = new Set(['hero', 'final']);
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const SAFE_AGGREGATE_VALUE = /^[a-z0-9][a-z0-9._~-]{0,79}$/;

function cleanPathname(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

function aggregateValue(value) {
  const raw = String(value || '').trim().toLowerCase();
  // UTM values are aggregate campaign labels, never an escape hatch for PII.
  if (!raw || raw.includes('@') || raw.length > 80) return null;
  const cleaned = raw
    .replace(/[^a-z0-9._~-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return SAFE_AGGREGATE_VALUE.test(cleaned) ? cleaned : null;
}

export async function onRequest(context) {
  const incoming = new URL(context.request.url);
  const pathname = cleanPathname(incoming.pathname);

  const legalDestination = LEGAL_URLS[pathname];
  if (legalDestination) {
    // Construct from a constant so no incoming query parameter can cross the boundary.
    return Response.redirect(legalDestination, 302);
  }

  const match = pathname.match(/^\/download\/([^/]+)$/);
  if (match) {
    const placement = match[1];
    if (!DOWNLOAD_PLACEMENTS.has(placement)) {
      return new Response('Not found', { status: 404 });
    }

    const destination = new URL(APP_STORE_URL);
    for (const key of UTM_KEYS) {
      const value = aggregateValue(incoming.searchParams.get(key));
      if (value) destination.searchParams.set(key, value);
    }
    // The CTA label comes exclusively from the trusted route, never from input.
    destination.searchParams.set('cta', placement);
    return Response.redirect(destination.toString(), 302);
  }

  return context.next();
}
