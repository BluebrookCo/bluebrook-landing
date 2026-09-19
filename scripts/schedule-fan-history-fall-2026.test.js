const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const campaign = require('../marketing/fan-history-sprint-2026-fall.json');
const {
  planFutureQueue,
  resolveImmediatelyBeforeCreate,
} = require('./schedule-nfl-2026-campaign');
const {
  assertSchedulingEnabled,
  scheduleCampaign,
  validateLandingUrl,
  validateManifest,
  validatePublishedAssets,
  weightedXLength,
} = require('./schedule-fan-history-fall-2026');

function cloneCampaign() {
  return JSON.parse(JSON.stringify(campaign));
}

function exactScheduledPost(spec, channelKey, id = `${spec.id}-${channelKey}`) {
  return {
    id,
    text: spec[channelKey],
    status: 'scheduled',
    channelId: channelKey === 'twitter'
      ? '6a7f27b4b2d9d57743782277'
      : '6a7f2557b2d9d57743781637',
    dueAt: spec.dueAt,
    assets: [{
      source: `${campaign.mediaBase}/${spec.asset}`,
      mimeType: 'image/png',
    }],
  };
}

test('committed fan-history campaign is coherent but remains fail-closed', async () => {
  assert.doesNotThrow(() => validateManifest());
  assert.doesNotThrow(() => validatePublishedAssets());
  assert.throws(
    () => assertSchedulingEnabled(),
    /disabled pending final queue review/,
  );
  await assert.rejects(
    () => scheduleCampaign(['twitter']),
    /disabled pending final queue review/,
  );
});

test('all X posts fit the weighted character limit', () => {
  for (const spec of campaign.posts) {
    assert.ok(weightedXLength(spec.twitter) <= 280, spec.id);
  }
});

test('rejects SEC language in an NFL creative', () => {
  const subject = cloneCampaign();
  const spec = subject.posts.find((post) => post.leagueSubject === 'nfl');
  spec.twitter = `SEC country, ${spec.twitter}`;
  assert.throws(
    () => validateManifest(subject, 'original Witnessed geometry'),
    /cross-league term: SEC/i,
  );
});

test('rejects NFL language in an SEC creative', () => {
  const subject = cloneCampaign();
  const spec = subject.posts.find((post) => post.leagueSubject === 'sec_cfb');
  spec.instagram += '\n#NFL';
  assert.throws(
    () => validateManifest(subject, 'original Witnessed geometry'),
    /cross-league term: #NFL/i,
  );
});

test('rejects unreviewed, duplicate, and competitor-derived assets', () => {
  const unreviewed = cloneCampaign();
  unreviewed.posts[0].assetStatus = 'draft';
  assert.throws(
    () => validateManifest(unreviewed, 'original Witnessed geometry'),
    /has not passed asset and rights review/,
  );

  const duplicate = cloneCampaign();
  duplicate.posts[1].asset = duplicate.posts[0].asset;
  assert.throws(
    () => validateManifest(duplicate, 'original Witnessed geometry'),
    /Duplicate or invalid asset/,
  );

  assert.throws(
    () => validateManifest(cloneCampaign(), 'Make this match Momento exactly'),
    /names a competitor/,
  );
});

test('requires fixed first-party privacy-safe routes for each platform', () => {
  const spec = cloneCampaign().posts[0];
  assert.doesNotThrow(() => validateLandingUrl(spec, 'twitter'));
  assert.doesNotThrow(() => validateLandingUrl(spec, 'instagram'));

  spec.landingUrls.twitter = 'https://bluebrook.co/c/x/fh01?email=person@example.com';
  assert.throws(
    () => validateLandingUrl(spec, 'twitter'),
    /privacy-safe first-party route/,
  );

  spec.landingUrls.twitter = 'https://example.com/c/x/fh01';
  assert.throws(
    () => validateLandingUrl(spec, 'twitter'),
    /privacy-safe first-party route/,
  );
});

test('rejects platform-route drift and raw URLs in Instagram captions', () => {
  const routeDrift = cloneCampaign();
  routeDrift.posts[0].landingUrls.twitter = 'https://bluebrook.co/c/ig/fh01';
  assert.throws(
    () => validateManifest(routeDrift, 'original Witnessed geometry'),
    /route channel does not match/,
  );

  const rawInstagramUrl = cloneCampaign();
  rawInstagramUrl.posts[0].instagram += ' https://bluebrook.co/c/ig/fh01';
  assert.throws(
    () => validateManifest(rawInstagramUrl, 'original Witnessed geometry'),
    /must use the profile link/,
  );
});

test('plans all future channel records and reuses exact queue entries', () => {
  const now = Date.parse('2026-09-19T16:00:00.000Z');
  const first = campaign.posts[0];
  const plan = planFutureQueue(
    {
      twitter: [exactScheduledPost(first, 'twitter')],
      instagram: [exactScheduledPost(first, 'instagram')],
    },
    { subject: campaign, nowMs: now },
  );
  assert.equal(plan.length, 12);
  assert.equal(plan.filter((row) => row.action === 'reuse').length, 2);
  assert.equal(plan.filter((row) => row.action === 'create').length, 10);
});

test('immediate recheck uses the mixed-league campaign media base exactly', async () => {
  const spec = campaign.posts[1];
  let createCalls = 0;
  const result = await resolveImmediatelyBeforeCreate({
    channelKey: 'twitter',
    spec,
    subject: campaign,
    listPostsFn: async () => [exactScheduledPost(spec, 'twitter', 'existing-fan-post')],
    createPostFn: async () => {
      createCalls += 1;
      return null;
    },
  });
  assert.equal(result.action, 'reuse');
  assert.equal(result.post.id, 'existing-fan-post');
  assert.equal(createCalls, 0);
});

test('publish directory must contain exactly six reviewed 1080x1350 PNGs', (t) => {
  const assetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'witnessed-fan-history-'));
  t.after(() => fs.rmSync(assetDir, { recursive: true, force: true }));
  const canonicalDir = path.resolve(__dirname, '..', campaign.assetDirectory);
  for (const spec of campaign.posts) {
    fs.copyFileSync(path.join(canonicalDir, spec.asset), path.join(assetDir, spec.asset));
  }
  assert.doesNotThrow(() => validatePublishedAssets(campaign, assetDir));

  fs.copyFileSync(
    path.join(canonicalDir, campaign.posts[0].asset),
    path.join(assetDir, 'obsolete.png'),
  );
  assert.throws(
    () => validatePublishedAssets(campaign, assetDir),
    /Obsolete campaign assets/,
  );
});

test('approval requires both status and boolean gate', () => {
  const statusOnly = cloneCampaign();
  statusOnly.status = 'approved_for_scheduling';
  assert.throws(() => assertSchedulingEnabled(statusOnly), /disabled/);

  const booleanOnly = cloneCampaign();
  booleanOnly.schedulingEnabled = true;
  assert.throws(() => assertSchedulingEnabled(booleanOnly), /disabled/);

  const approved = cloneCampaign();
  approved.status = 'approved_for_scheduling';
  approved.schedulingEnabled = true;
  assert.doesNotThrow(() => assertSchedulingEnabled(approved));
});
