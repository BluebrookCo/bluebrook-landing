const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const campaign = require('../marketing/fan-history-sprint-2026-fall.json');

function weightedXLength(text) {
  const urls = String(text).match(/https:\/\/\S+/g) || [];
  return text.length - urls.reduce((total, url) => total + url.length - 23, 0);
}

const assetDirectory = path.resolve(__dirname, '..', campaign.assetDirectory);

test('rendered campaign remains fail-closed until final queue review', () => {
  assert.equal(campaign.status, 'rendered_pending_final_queue_review');
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

test('each campaign post is single-league coherent', () => {
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

test('copy and rendered artwork stay publish-safe', () => {
  const ids = new Set();
  const assets = new Set();
  for (const post of campaign.posts) {
    assert.ok(!ids.has(post.id), `duplicate ID ${post.id}`);
    assert.ok(!assets.has(post.asset), `duplicate asset ${post.asset}`);
    ids.add(post.id);
    assets.add(post.asset);
    assert.equal(post.assetStatus, 'rendered_reviewed');
    assert.equal(post.assetRights, 'original_geometry_and_typography_only');
    assert.ok(post.asset.endsWith('.png'));
    assert.ok(post.altText.length > 30 && post.altText.length <= 1000);
    assert.ok(weightedXLength(post.twitter) <= 280, `${post.id} exceeds X weighted length`);
    assert.ok(post.instagram.length <= 2200, `${post.id} exceeds Instagram length`);

    const bytes = fs.readFileSync(path.join(assetDirectory, post.asset));
    assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG', `${post.id} is not PNG`);
    assert.equal(bytes.readUInt32BE(16), 1080, `${post.id} width drift`);
    assert.equal(bytes.readUInt32BE(20), 1350, `${post.id} height drift`);
  }
  const actualAssets = fs.readdirSync(assetDirectory).filter((name) => name.endsWith('.png')).sort();
  assert.deepEqual(actualAssets, [...assets].sort(), 'publish directory contains missing or obsolete assets');
});

test('every channel uses a fixed, privacy-safe first-party campaign route', () => {
  for (const post of campaign.posts) {
    for (const channel of ['twitter', 'instagram']) {
      const url = new URL(post.landingUrls[channel]);
      assert.equal(url.origin, 'https://bluebrook.co');
      assert.match(url.pathname, channel === 'twitter' ? /^\/c\/x\/fh\d{2}$/ : /^\/c\/ig\/fh\d{2}$/);
      assert.equal(url.search, '');
      assert.doesNotMatch(url.pathname, /user|event|email|handle|@/i);
    }
    assert.ok(post.twitter.includes(post.landingUrls.twitter), `${post.id} X URL drift`);
    assert.doesNotMatch(post.instagram, /https?:\/\//, `${post.id} Instagram caption should use link in bio`);
  }
});

test('campaign dates are ordered and spaced for three strong posts per week', () => {
  const dueTimes = campaign.posts.map((post) => Date.parse(post.dueAt));
  assert.ok(dueTimes.every(Number.isFinite));
  for (let index = 1; index < dueTimes.length; index += 1) {
    assert.ok(dueTimes[index] > dueTimes[index - 1], 'campaign dates must be chronological');
    assert.ok(dueTimes[index] - dueTimes[index - 1] >= 36 * 60 * 60 * 1000, 'campaign posts are too close');
  }
});
