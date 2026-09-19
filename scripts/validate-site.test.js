const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const middlewarePath = path.join(root, 'functions', '_middleware.js');

async function loadMiddleware() {
  const source = fs.readFileSync(middlewarePath, 'utf8');
  const encoded = Buffer.from(source).toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

async function requestRedirect(pathname) {
  const { onRequest } = await loadMiddleware();
  return onRequest({
    request: new Request(`https://bluebrook.co${pathname}`),
    next: () => new Response('next', { status: 200 }),
  });
}

test('first-party legal paths drop every incoming query parameter', async () => {
  for (const [pathname, expected] of [
    ['/privacy', 'https://seenlive-production.up.railway.app/privacy'],
    ['/privacy/', 'https://seenlive-production.up.railway.app/privacy'],
    ['/terms', 'https://seenlive-production.up.railway.app/terms'],
    ['/terms/', 'https://seenlive-production.up.railway.app/terms'],
  ]) {
    const response = await requestRedirect(`${pathname}?email=davis%40example.com&user_id=42&event=abc&utm_source=twitter`);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), expected);
  }

  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
  assert.doesNotMatch(html, /href="https:\/\/seenlive-production\.up\.railway\.app\/(?:privacy|terms)"/);
});

test('download redirects rebuild only safe aggregate attribution', async () => {
  const response = await requestRedirect(
    '/download/hero?utm_source=Twitter&utm_medium=Organic%20Social&utm_campaign=nfl_kickoff-2026'
      + '&utm_content=Hero.Card&utm_term=week_1&cta=attacker&email=davis%40example.com'
      + '&user_id=42&event_id=game-7&redirect=https%3A%2F%2Fevil.example',
  );
  assert.equal(response.status, 302);

  const location = response.headers.get('location');
  const destination = new URL(location);
  assert.equal(destination.origin + destination.pathname, 'https://apps.apple.com/app/id6781100911');
  assert.deepEqual([...destination.searchParams.entries()], [
    ['utm_source', 'twitter'],
    ['utm_medium', 'organic_social'],
    ['utm_campaign', 'nfl_kickoff-2026'],
    ['utm_content', 'hero.card'],
    ['utm_term', 'week_1'],
    ['cta', 'hero'],
  ]);
  for (const forbidden of ['email', 'user_id', 'event_id', 'redirect']) {
    assert.equal(destination.searchParams.has(forbidden), false);
  }
  assert.doesNotMatch(location, /davis|example\.com|game-7|evil/i);
});

test('download redirects reject PII-shaped UTM values and untrusted placements', async () => {
  const response = await requestRedirect(
    '/download/final?utm_source=davis%40example.com&utm_medium=website&cta=hero&email=secret',
  );
  const destination = new URL(response.headers.get('location'));
  assert.equal(destination.searchParams.has('utm_source'), false);
  assert.equal(destination.searchParams.get('utm_medium'), 'website');
  assert.equal(destination.searchParams.get('cta'), 'final');
  assert.equal(destination.searchParams.has('email'), false);

  const unknown = await requestRedirect('/download/profile?utm_source=twitter');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.has('location'), false);
});

test('unrelated paths continue through the Pages middleware', async () => {
  const response = await requestRedirect('/assets/witnessed-icon.png?email=local-only');
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'next');
});

test('App Store CTAs use measurable first-party hops with aggregate attribution only', () => {
  assert.match(
    html,
    /href="\/download\/hero\?utm_source=bluebrook&amp;utm_medium=website&amp;utm_campaign=evergreen_2026&amp;utm_content=hero" data-download-placement="hero"/,
  );
  assert.match(
    html,
    /href="\/download\/final\?utm_source=bluebrook&amp;utm_medium=website&amp;utm_campaign=evergreen_2026&amp;utm_content=final" data-download-placement="final"/,
  );
  assert.match(html, /const allowed = \['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'\]/);
  assert.match(html, /raw\.includes\('@'\)/);
  assert.doesNotMatch(html, /localStorage|document\.cookie|user_id|email/i);
});
