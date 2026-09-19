const test = require('node:test');
const assert = require('node:assert/strict');

const campaign = require('../marketing/fan-history-sprint-2026-fall.json');

function weightedXLength(text) {
  const urls = String(text).match(/https:\/\/\S+/g) || [];
  return text.length - urls.reduce((total, url) => total + url.length - 23, 0);
}

test('draft cannot be mistaken for an approved scheduling manifest', () => {
  assert.equal(campaign.status, 'reviewed_draft_do_not_schedule');
  assert.equal(campaign.schedulingEnabled, false);
  assert.equal(campaign.posts.length, 6);
  assert.deepEqual(
    Object.fromEntries([1, 2].map((week) => [
      week,
      campaign.posts.filter((post) => post.week === week).length,
    ])),
    { 1: 3, 2: 3 },
  );
});

test('each draft post is single-league coherent', () => {
  for (const post of campaign.posts) {
    const creative = [post.twitter, post.instagram, post.altText, post.assetBrief].join('\n');
    assert.ok(['nfl', 'sec_cfb'].includes(post.leagueSubject), `${post.id} has a valid league`);
    if (post.leagueSubject === 'nfl') {
      assert.doesNotMatch(creative, /#secfootball|\b(?:sec|college|school|saturday)\b/i, post.id);
    } else {
      assert.doesNotMatch(creative, /#nfl|\bnfl\b|\bpro football\b|\bsunday\b/i, post.id);
    }
  }
});

test('copy and artwork briefs stay publish-safe', () => {
  const ids = new Set();
  const assets = new Set();
  for (const post of campaign.posts) {
    assert.ok(!ids.has(post.id), `duplicate ID ${post.id}`);
    assert.ok(!assets.has(post.asset), `duplicate asset ${post.asset}`);
    ids.add(post.id);
    assets.add(post.asset);
    assert.equal(post.assetStatus, 'draft_not_rendered');
    assert.equal(post.assetRights, 'original_geometry_and_typography_only');
    assert.ok(post.asset.endsWith('.png'));
    assert.ok(post.altText.length > 30 && post.altText.length <= 1000);
    assert.ok(weightedXLength(post.twitter) <= 280, `${post.id} exceeds X weighted length`);
    assert.ok(post.instagram.length <= 2200, `${post.id} exceeds Instagram length`);
  }
});

test('every channel has aggregate, privacy-safe landing attribution', () => {
  const allowedKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  for (const post of campaign.posts) {
    for (const channel of ['twitter', 'instagram']) {
      const url = new URL(post.landingUrls[channel]);
      assert.equal(url.origin, 'https://bluebrook.co');
      assert.equal(url.pathname, '/');
      assert.deepEqual([...url.searchParams.keys()], allowedKeys);
      assert.equal(url.searchParams.get('utm_source'), channel === 'twitter' ? 'x' : 'instagram');
      assert.equal(url.searchParams.get('utm_medium'), 'organic_social');
      assert.equal(url.searchParams.get('utm_campaign'), campaign.measurement.campaign);
      assert.match(url.searchParams.get('utm_content'), /^[a-z0-9_]{1,80}$/);
      assert.doesNotMatch(url.search, /user|event|email|handle|@/i);
    }
    assert.ok(post.twitter.includes(post.landingUrls.twitter), `${post.id} X URL drift`);
    assert.doesNotMatch(post.instagram, /https?:\/\//, `${post.id} Instagram caption should use link in bio`);
  }
});

test('draft dates are ordered and spaced for three strong posts per week', () => {
  const dueTimes = campaign.posts.map((post) => Date.parse(post.dueAt));
  assert.ok(dueTimes.every(Number.isFinite));
  for (let index = 1; index < dueTimes.length; index += 1) {
    assert.ok(dueTimes[index] > dueTimes[index - 1], 'draft dates must be chronological');
    assert.ok(dueTimes[index] - dueTimes[index - 1] >= 36 * 60 * 60 * 1000, 'draft posts are too close');
  }
});
