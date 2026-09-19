const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const campaign = require('../marketing/nfl-2026-kickoff-campaign.json');
const {
  listPosts,
  planFutureQueue,
  resolveImmediatelyBeforeCreate,
  selectFutureSpecs,
  validateManifest,
  validatePublishedAssets,
} = require('./schedule-nfl-2026-campaign');

function cloneCampaign() {
  return JSON.parse(JSON.stringify(campaign));
}

test('committed NFL campaign is league coherent', () => {
  assert.doesNotThrow(() => validateManifest());
});

test('rejects college framing in NFL copy', () => {
  const subject = cloneCampaign();
  subject.posts[0].twitter = 'College fans: name your favorite NFL team.';
  assert.throws(
    () => validateManifest(subject, 'NFL-only artwork'),
    /cross-league term: College/i,
  );
});

test('rejects SEC hashtags in NFL captions', () => {
  const subject = cloneCampaign();
  subject.posts[0].instagram += '\n#SECFootball';
  assert.throws(
    () => validateManifest(subject, 'NFL-only artwork'),
    /cross-league term: #SECFootball/i,
  );
});

test('rejects cross-league wording in alt text and artwork', () => {
  const altSubject = cloneCampaign();
  altSubject.posts[0].altText = 'School first, NFL team second.';
  assert.throws(
    () => validateManifest(altSubject, 'NFL-only artwork'),
    /cross-league term: School/i,
  );

  assert.throws(
    () => validateManifest(cloneCampaign(), 'Who gets the screen in SEC country?'),
    /rendered artwork source contains cross-league term: SEC/i,
  );
});

test('rejects regional audience framing in NFL subject matter', () => {
  const subject = structuredClone(campaign);
  subject.posts[0].twitter = 'The Southern Six-Pack is live.';
  assert.throws(
    () => validateManifest(subject, 'NFL-only artwork'),
    /cross-league term: Southern/i,
  );
});

test('selects only posts that are still schedulable for the requested channel', () => {
  const now = Date.parse('2026-09-19T16:00:00.000Z');
  assert.deepEqual(
    selectFutureSpecs(campaign, ['twitter'], now).map((spec) => spec.id),
    ['nfl26-10-i85-civil-war'],
  );
  assert.deepEqual(
    selectFutureSpecs(campaign, ['instagram'], now).map((spec) => spec.id),
    ['nfl26-10-i85-civil-war'],
  );
  assert.deepEqual(
    selectFutureSpecs(campaign, ['twitter'], Date.parse('2026-09-21T00:00:00.000Z')),
    [],
  );
});

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

test('plans an idempotent reuse without requiring stale campaign history', () => {
  const now = Date.parse('2026-09-19T16:00:00.000Z');
  const finalSpec = campaign.posts.at(-1);
  const plan = planFutureQueue(
    { twitter: [exactScheduledPost(finalSpec, 'twitter')] },
    { channelKeys: ['twitter'], nowMs: now },
  );
  assert.equal(plan.length, 1);
  assert.equal(plan[0].spec.id, finalSpec.id);
  assert.equal(plan[0].action, 'reuse');
});

test('plans only a missing future record and ignores missing past records', () => {
  const now = Date.parse('2026-09-19T16:00:00.000Z');
  const plan = planFutureQueue(
    { twitter: [] },
    { channelKeys: ['twitter'], nowMs: now },
  );
  assert.deepEqual(
    plan.map((row) => [row.spec.id, row.channelKey, row.action]),
    [['nfl26-10-i85-civil-war', 'twitter', 'create']],
  );
});

test('fails closed on duplicate or non-scheduled future records', () => {
  const now = Date.parse('2026-09-19T16:00:00.000Z');
  const finalSpec = campaign.posts.at(-1);
  const exact = exactScheduledPost(finalSpec, 'twitter');
  assert.throws(
    () => planFutureQueue(
      { twitter: [exact, { ...exact, id: 'duplicate' }] },
      { channelKeys: ['twitter'], nowMs: now },
    ),
    /Multiple existing records/,
  );
  assert.throws(
    () => planFutureQueue(
      { twitter: [{ ...exact, status: 'sent' }] },
      { channelKeys: ['twitter'], nowMs: now },
    ),
    /unexpected future status sent/,
  );
  assert.throws(
    () => planFutureQueue(
      {
        twitter: [
          exact,
          {
            ...exact,
            id: 'unrelated-collision',
            text: 'Different scheduled post',
            assets: [],
          },
        ],
      },
      { channelKeys: ['twitter'], nowMs: now },
    ),
    /within 45 minutes of existing unrelated-collision/,
  );
});

test('rejects manifest posts that collide on the same channel', () => {
  const subject = cloneCampaign();
  subject.posts[1].dueAt = new Date(
    Date.parse(subject.posts[0].dueAt) + 20 * 60 * 1000,
  ).toISOString();
  assert.throws(
    () => validateManifest(subject, 'NFL-only artwork'),
    /within 45 minutes of manifest post/,
  );
});

test('publish directory must contain exactly the canonical campaign assets', (t) => {
  const assetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'witnessed-social-assets-'));
  t.after(() => fs.rmSync(assetDir, { recursive: true, force: true }));
  for (const spec of campaign.posts) fs.writeFileSync(path.join(assetDir, spec.asset), 'png');
  assert.doesNotThrow(() => validatePublishedAssets(campaign, assetDir));

  fs.writeFileSync(path.join(assetDir, 'obsolete-cross-league.png'), 'png');
  assert.throws(
    () => validatePublishedAssets(campaign, assetDir),
    /Obsolete campaign assets in publish path: obsolete-cross-league\.png/,
  );
});

test('listPosts follows every Buffer page and de-duplicates repeated edge IDs', async () => {
  const calls = [];
  const pages = [
    {
      posts: {
        edges: [
          { cursor: 'edge-1', node: { id: 'post-1' } },
          { cursor: 'edge-2', node: { id: 'post-2' } },
        ],
        pageInfo: { hasNextPage: true, endCursor: 'page-1' },
      },
    },
    {
      posts: {
        edges: [
          { cursor: 'edge-2-again', node: { id: 'post-2' } },
          { cursor: 'edge-3', node: { id: 'post-3' } },
        ],
        pageInfo: { hasNextPage: false, endCursor: 'page-2' },
      },
    },
  ];
  const posts = await listPosts('channel-1', async (query, variables) => {
    calls.push({ query, variables });
    return pages.shift();
  });

  assert.deepEqual(posts.map((post) => post.id), ['post-1', 'post-2', 'post-3']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].variables.after, null);
  assert.equal(calls[1].variables.after, 'page-1');
  assert.match(calls[0].query, /pageInfo \{ hasNextPage endCursor \}/);
});

test('listPosts fails closed if Buffer pagination stops advancing', async () => {
  let calls = 0;
  await assert.rejects(
    () => listPosts('channel-1', async () => {
      calls += 1;
      return {
        posts: {
          edges: [],
          pageInfo: { hasNextPage: true, endCursor: 'stuck' },
        },
      };
    }),
    /pagination stalled/,
  );
  assert.equal(calls, 2);
});

test('immediate pre-create recheck reuses an exact post without mutating', async () => {
  const spec = campaign.posts.at(-1);
  let createCalls = 0;
  const result = await resolveImmediatelyBeforeCreate({
    channelKey: 'twitter',
    spec,
    listPostsFn: async () => [exactScheduledPost(spec, 'twitter', 'won-the-race')],
    createPostFn: async () => {
      createCalls += 1;
      return null;
    },
  });

  assert.equal(result.action, 'reuse');
  assert.equal(result.post.id, 'won-the-race');
  assert.equal(createCalls, 0);
});

test('immediate pre-create recheck blocks a newly appeared schedule collision', async () => {
  const spec = campaign.posts.at(-1);
  let createCalls = 0;
  await assert.rejects(
    () => resolveImmediatelyBeforeCreate({
      channelKey: 'twitter',
      spec,
      listPostsFn: async () => [{
        id: 'new-collision',
        text: 'Unrelated post that appeared after preflight',
        status: 'scheduled',
        channelId: '6a7f27b4b2d9d57743782277',
        dueAt: spec.dueAt,
        assets: [],
      }],
      createPostFn: async () => {
        createCalls += 1;
        return null;
      },
    }),
    /within 45 minutes of existing new-collision/,
  );
  assert.equal(createCalls, 0);
});

test('immediate pre-create recheck creates only after a fresh empty queue read', async () => {
  const spec = campaign.posts.at(-1);
  const order = [];
  const result = await resolveImmediatelyBeforeCreate({
    channelKey: 'twitter',
    spec,
    listPostsFn: async () => {
      order.push('list');
      return [];
    },
    createPostFn: async () => {
      order.push('create');
      return exactScheduledPost(spec, 'twitter', 'created-post');
    },
  });

  assert.deepEqual(order, ['list', 'create']);
  assert.equal(result.action, 'create');
  assert.equal(result.post.id, 'created-post');
});
