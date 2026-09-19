const fs = require('fs');
const path = require('path');
const campaign = require('../marketing/nfl-2026-kickoff-campaign.json');

const API = 'https://api.buffer.com';
const ORGANIZATION_ID = '6a7f23b911563269b3a59cf8';
const COLLISION_WINDOW_MS = 45 * 60 * 1000;
const MIN_SCHEDULE_LEAD_MS = 10 * 60 * 1000;
const RENDER_SOURCE_PATH = path.join(__dirname, 'render-nfl-2026-campaign.js');
const CAMPAIGN_ASSET_DIR = path.join(
  __dirname,
  '..',
  'assets',
  'social',
  'campaigns',
  'nfl-2026-kickoff',
);
const NFL_CROSS_LEAGUE_PATTERN = /#secfootball|\b(?:sec|cfb|college|school|southern|saturdays?)\b/i;

const CHANNELS = {
  instagram: {
    id: '6a7f2557b2d9d57743781637',
    name: 'getwitnessed',
    service: 'instagram',
  },
  twitter: {
    id: '6a7f27b4b2d9d57743782277',
    name: 'getWitnessed',
    service: 'twitter',
  },
};

function mediaUrl(spec, subject = campaign) {
  return `${subject.mediaBase}/${spec.asset}`;
}

function specsForChannel(channelKey, subject = campaign) {
  return subject.posts.filter((post) => post.channels.includes(channelKey));
}

function selectFutureSpecs(
  subject = campaign,
  channelKeys = Object.keys(CHANNELS),
  nowMs = Date.now(),
  minLeadMs = MIN_SCHEDULE_LEAD_MS,
) {
  const cutoff = nowMs + minLeadMs;
  return subject.posts.filter((spec) => (
    spec.channels.some((channelKey) => channelKeys.includes(channelKey))
    && new Date(spec.dueAt).getTime() > cutoff
  ));
}

function assertNflOnly(label, value) {
  const match = String(value || '').match(NFL_CROSS_LEAGUE_PATTERN);
  if (match) {
    throw new Error(`NFL campaign ${label} contains cross-league term: ${match[0]}`);
  }
}

function validateManifest(subject = campaign, renderSource = null) {
  if (!subject.campaignId || !subject.mediaBase?.startsWith('https://')) {
    throw new Error('Campaign identity or media base is invalid');
  }
  if (subject.primaryLeague !== 'nfl' || subject.scope !== 'single_league') {
    throw new Error('NFL campaign must declare primaryLeague=nfl and scope=single_league');
  }
  if (!subject.audiencePersona?.trim()) {
    throw new Error('NFL campaign must separate its audience persona from its content subject');
  }
  if (!Array.isArray(subject.posts) || subject.posts.length === 0) {
    throw new Error('Campaign has no posts');
  }

  const ids = new Set();
  const assets = new Set();
  const channelTexts = new Set();
  const schedulesByChannel = new Map();
  for (const spec of subject.posts) {
    if (!spec.id || ids.has(spec.id)) throw new Error(`Duplicate or missing post ID: ${spec.id}`);
    ids.add(spec.id);
    if (!spec.asset?.endsWith('.png') || assets.has(spec.asset)) {
      throw new Error(`Duplicate or invalid asset for ${spec.id}`);
    }
    assets.add(spec.asset);
    if (!spec.altText || spec.altText.length > 1000) throw new Error(`Invalid alt text for ${spec.id}`);
    for (const [field, value] of Object.entries({
      id: spec.id,
      asset: spec.asset,
      altText: spec.altText,
      twitter: spec.twitter,
      instagram: spec.instagram,
    })) {
      assertNflOnly(`${spec.id}.${field}`, value);
    }
    const dueAt = new Date(spec.dueAt);
    if (!Number.isFinite(dueAt.getTime()) || dueAt.toISOString() !== spec.dueAt) {
      throw new Error(`Invalid UTC schedule for ${spec.id}`);
    }
    if (!Array.isArray(spec.channels) || spec.channels.length === 0) {
      throw new Error(`No channels for ${spec.id}`);
    }
    for (const channelKey of spec.channels) {
      if (!CHANNELS[channelKey]) throw new Error(`Unsupported channel ${channelKey} for ${spec.id}`);
      const text = spec[channelKey];
      if (!text?.trim()) throw new Error(`Missing ${channelKey} copy for ${spec.id}`);
      if (channelKey === 'twitter' && text.length > 280) {
        throw new Error(`${spec.id} exceeds X's 280-character limit (${text.length})`);
      }
      const fingerprint = `${channelKey}\u0000${text}`;
      if (channelTexts.has(fingerprint)) throw new Error(`Duplicate ${channelKey} copy for ${spec.id}`);
      channelTexts.add(fingerprint);

      const channelSchedule = schedulesByChannel.get(channelKey) || [];
      channelSchedule.push({ id: spec.id, dueAt: dueAt.getTime() });
      schedulesByChannel.set(channelKey, channelSchedule);
    }
  }

  for (const [channelKey, channelSchedule] of schedulesByChannel.entries()) {
    channelSchedule.sort((a, b) => a.dueAt - b.dueAt);
    for (let index = 1; index < channelSchedule.length; index += 1) {
      const previous = channelSchedule[index - 1];
      const current = channelSchedule[index];
      if (current.dueAt - previous.dueAt < COLLISION_WINDOW_MS) {
        throw new Error(
          `${current.id}/${channelKey} is within 45 minutes of manifest post ${previous.id}`,
        );
      }
    }
  }

  const source = renderSource === null
    ? fs.readFileSync(RENDER_SOURCE_PATH, 'utf8')
    : renderSource;
  assertNflOnly('rendered artwork source', source);
}

function validatePublishedAssets(subject = campaign, assetDir = CAMPAIGN_ASSET_DIR) {
  const expected = new Set(subject.posts.map((spec) => spec.asset));
  const actual = new Set(
    fs.readdirSync(assetDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
      .map((entry) => entry.name),
  );
  const missing = [...expected].filter((asset) => !actual.has(asset));
  const obsolete = [...actual].filter((asset) => !expected.has(asset));
  if (missing.length) throw new Error(`Missing campaign assets: ${missing.join(', ')}`);
  if (obsolete.length) throw new Error(`Obsolete campaign assets in publish path: ${obsolete.join(', ')}`);
}

async function request(query, variables) {
  const apiKey = process.env.WITNESSED_BUFFER_KEY;
  if (!apiKey) throw new Error('WITNESSED_BUFFER_KEY is required');
  const response = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.map((error) => error.message).join('; ') || `Buffer HTTP ${response.status}`);
  }
  return payload.data;
}

async function verifyMedia(url) {
  const response = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  const contentType = response.headers.get('content-type') || '';
  if (![200, 206].includes(response.status) || !contentType.startsWith('image/png')) {
    throw new Error(`Media is not a direct public PNG: ${url}`);
  }
}

async function loadChannels() {
  const query = `
    query WitnessedCampaignChannels($input: ChannelsInput!) {
      channels(input: $input) {
        id name service isDisconnected isLocked isQueuePaused
      }
    }
  `;
  const data = await request(query, { input: { organizationId: ORGANIZATION_ID } });
  return data.channels || [];
}

async function listPosts(channelId, requestFn = request) {
  const query = `
    query WitnessedCampaignPosts($input: PostsInput!, $first: Int!, $after: String) {
      posts(input: $input, first: $first, after: $after) {
        edges {
          cursor
          node {
            id text status channelId dueAt sentAt externalLink
            error { message supportUrl }
            assets { source mimeType }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;
  const posts = [];
  const seenIds = new Set();
  const seenCursors = new Set();
  let after = null;

  do {
    const data = await requestFn(query, {
      input: {
        organizationId: ORGANIZATION_ID,
        filter: {
          channelIds: [channelId],
          status: ['scheduled', 'sending', 'sent', 'error'],
        },
        sort: [{ field: 'createdAt', direction: 'desc' }],
      },
      first: 100,
      after,
    });
    const connection = data.posts || {};
    for (const edge of connection.edges || []) {
      if (!edge?.node?.id || seenIds.has(edge.node.id)) continue;
      seenIds.add(edge.node.id);
      posts.push(edge.node);
    }

    if (!connection.pageInfo?.hasNextPage) break;
    const nextCursor = connection.pageInfo.endCursor;
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error(`Buffer pagination stalled for channel ${channelId}`);
    }
    seenCursors.add(nextCursor);
    after = nextCursor;
  } while (true);

  return posts;
}

function hasExactAsset(post, spec, subject = campaign) {
  const expected = mediaUrl(spec, subject);
  return post.assets?.some((asset) => asset.source === expected && asset.mimeType === 'image/png') || false;
}

function assertExactPost(post, channelKey, spec, subject = campaign) {
  if (!post) throw new Error(`Missing ${spec.id}/${channelKey}`);
  if (post.text !== spec[channelKey]) throw new Error(`${spec.id}/${channelKey} text drift`);
  if (post.channelId !== CHANNELS[channelKey].id) throw new Error(`${spec.id}/${channelKey} channel drift`);
  if (!hasExactAsset(post, spec, subject)) throw new Error(`${spec.id}/${channelKey} media drift`);
  if (!post.dueAt || new Date(post.dueAt).toISOString() !== spec.dueAt) {
    throw new Error(`${spec.id}/${channelKey} schedule drift`);
  }
}

function findExisting(posts, channelKey, spec, subject = campaign) {
  const textMatches = posts.filter((post) => post.text === spec[channelKey]);
  const assetMatches = posts.filter((post) => hasExactAsset(post, spec, subject));
  const combined = [...new Map([...textMatches, ...assetMatches].map((post) => [post.id, post])).values()];
  if (combined.length > 1) throw new Error(`Multiple existing records for ${spec.id}/${channelKey}`);
  if (combined.length === 1) {
    assertExactPost(combined[0], channelKey, spec, subject);
    return combined[0];
  }
  return null;
}

function assertNoCollision(posts, channelKey, spec, ignorePostId = null) {
  const target = new Date(spec.dueAt).getTime();
  const collision = posts.find((post) => {
    if (post.id === ignorePostId) return false;
    if (!post.dueAt || !['scheduled', 'sending'].includes(post.status)) return false;
    return Math.abs(new Date(post.dueAt).getTime() - target) < COLLISION_WINDOW_MS;
  });
  if (collision) {
    throw new Error(
      `${spec.id}/${channelKey} is within 45 minutes of existing ${collision.id} at ${collision.dueAt}`,
    );
  }
}

function planFutureQueue(
  postsByChannel,
  {
    subject = campaign,
    channelKeys = Object.keys(CHANNELS),
    nowMs = Date.now(),
    minLeadMs = MIN_SCHEDULE_LEAD_MS,
  } = {},
) {
  const specs = selectFutureSpecs(subject, channelKeys, nowMs, minLeadMs);
  const rows = [];
  for (const spec of specs) {
    const targetChannels = spec.channels.filter((channelKey) => channelKeys.includes(channelKey));
    for (const channelKey of targetChannels) {
      const posts = postsByChannel[channelKey] || [];
      const existing = findExisting(posts, channelKey, spec, subject);
      if (existing) {
        if (existing.status !== 'scheduled') {
          throw new Error(`${spec.id}/${channelKey} has unexpected future status ${existing.status}`);
        }
      }
      assertNoCollision(posts, channelKey, spec, existing?.id || null);
      rows.push({
        spec,
        channelKey,
        action: existing ? 'reuse' : 'create',
        post: existing,
      });
    }
  }
  return rows;
}

async function preflight({
  channelKeys = Object.keys(CHANNELS),
  nowMs = Date.now(),
  minLeadMs = MIN_SCHEDULE_LEAD_MS,
} = {}) {
  validateManifest();
  validatePublishedAssets();
  const channels = await loadChannels();
  for (const channelKey of channelKeys) {
    const expected = CHANNELS[channelKey];
    const actual = channels.find((channel) => channel.id === expected.id);
    if (!actual) throw new Error(`Missing ${expected.service} channel`);
    if (actual.name !== expected.name || actual.service !== expected.service) {
      throw new Error(`Channel identity mismatch for ${expected.service}`);
    }
    if (actual.isDisconnected || actual.isLocked || actual.isQueuePaused) {
      throw new Error(`${expected.service} channel is unavailable or paused`);
    }
  }

  const futureSpecs = selectFutureSpecs(campaign, channelKeys, nowMs, minLeadMs);
  await Promise.all(futureSpecs.map((spec) => verifyMedia(mediaUrl(spec))));

  const postsByChannel = {};
  for (const channelKey of channelKeys) {
    const channel = CHANNELS[channelKey];
    postsByChannel[channelKey] = await listPosts(channel.id);
  }

  const plan = planFutureQueue(postsByChannel, { channelKeys, nowMs, minLeadMs });
  return { postsByChannel, futureSpecs, plan };
}

async function createPost(channelKey, spec) {
  const input = {
    text: spec[channelKey],
    channelId: CHANNELS[channelKey].id,
    schedulingType: 'automatic',
    mode: 'customScheduled',
    dueAt: spec.dueAt,
    aiAssisted: false,
    assets: [{
      image: {
        url: mediaUrl(spec),
        metadata: { altText: spec.altText },
      },
    }],
  };
  if (channelKey === 'instagram') {
    input.metadata = {
      instagram: {
        type: 'post',
        shouldShareToFeed: true,
      },
    };
  }

  const mutation = `
    mutation WitnessedCampaignCreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id text status channelId dueAt sentAt externalLink
            error { message supportUrl }
            assets { source mimeType }
          }
        }
        ... on MutationError { message }
      }
    }
  `;
  const data = await request(mutation, { input });
  if (data.createPost?.message) throw new Error(data.createPost.message);
  if (!data.createPost?.post?.id) throw new Error('Buffer did not return a created post');
  return data.createPost.post;
}

async function resolveImmediatelyBeforeCreate({
  channelKey,
  spec,
  subject = campaign,
  listPostsFn = listPosts,
  createPostFn = createPost,
}) {
  // Buffer does not expose an atomic create-if-absent operation. Refreshing the
  // complete channel queue immediately before mutation narrows the only race
  // window and makes reruns reuse an exact record instead of duplicating it.
  const latestPosts = await listPostsFn(CHANNELS[channelKey].id);
  const existing = findExisting(latestPosts, channelKey, spec, subject);
  if (existing) {
    if (existing.status !== 'scheduled') {
      throw new Error(`${spec.id}/${channelKey} has unexpected future status ${existing.status}`);
    }
    assertNoCollision(latestPosts, channelKey, spec, existing.id);
    return { post: existing, action: 'reuse' };
  }

  assertNoCollision(latestPosts, channelKey, spec);
  const post = await createPostFn(channelKey, spec);
  return { post, action: 'create' };
}

async function getPost(id) {
  const query = `
    query WitnessedCampaignPost($input: PostInput!) {
      post(input: $input) {
        id text status channelId dueAt sentAt externalLink
        error { message supportUrl }
        assets { source mimeType }
      }
    }
  `;
  const data = await request(query, { input: { id } });
  return data.post;
}

async function scheduleCampaign(channelKeys) {
  const { postsByChannel, plan } = await preflight({ channelKeys });
  const scheduled = [];
  for (const row of plan) {
    const { spec, channelKey } = row;
    let post = row.post;
    if (!post) {
      const resolved = await resolveImmediatelyBeforeCreate({ channelKey, spec });
      post = resolved.post;
      postsByChannel[channelKey].push(post);
      console.log(`${resolved.action === 'create' ? 'CREATED' : 'REUSED'} ${spec.id}/${channelKey}: ${post.id}`);
    } else {
      console.log(`REUSED ${spec.id}/${channelKey}: ${post.id}`);
    }
    const verified = await getPost(post.id);
    assertExactPost(verified, channelKey, spec);
    if (verified.status === 'error') {
      throw new Error(`${spec.id}/${channelKey} failed: ${verified.error?.message || 'unknown error'}`);
    }
    if (verified.status !== 'scheduled') {
      throw new Error(`${spec.id}/${channelKey} has unexpected status ${verified.status}`);
    }
    scheduled.push({ id: spec.id, channel: channelKey, bufferId: verified.id, dueAt: verified.dueAt });
    console.log(`VERIFIED ${spec.id}/${channelKey}: ${verified.dueAt}`);
  }
  console.log(`SCHEDULED ${JSON.stringify(scheduled)}`);
}

async function verifyFutureQueue(channelKeys) {
  // Queue validation covers every not-yet-due record, even when it is too late
  // for the scheduler's ten-minute creation safety window.
  const { plan } = await preflight({ channelKeys, minLeadMs: 0 });
  const missing = plan.filter((row) => row.action === 'create');
  const rows = plan.map((row) => ({
    id: row.spec.id,
    channel: row.channelKey,
    found: row.action === 'reuse',
    bufferId: row.post?.id || null,
    status: row.post?.status || null,
    dueAt: row.spec.dueAt,
  }));
  console.log(`QUEUE_AUDIT ${JSON.stringify(rows)}`);
  if (missing.length) {
    throw new Error(
      `Missing future queue records: ${missing.map((row) => `${row.spec.id}/${row.channelKey}`).join(', ')}`,
    );
  }
}

async function audit({ strict = false, channelKeys = Object.keys(CHANNELS) } = {}) {
  validateManifest();
  const rows = [];
  for (const [channelKey, channel] of Object.entries(CHANNELS)) {
    if (!channelKeys.includes(channelKey)) continue;
    const posts = await listPosts(channel.id);
    for (const spec of specsForChannel(channelKey)) {
      const matching = findExisting(posts, channelKey, spec);
      if (strict && !matching) throw new Error(`Missing ${spec.id}/${channelKey}`);
      if (matching) {
        assertExactPost(matching, channelKey, spec);
        const dueHasPassed = new Date(spec.dueAt).getTime() <= Date.now();
        const allowed = dueHasPassed ? ['sent', 'sending', 'scheduled'] : ['scheduled'];
        if (!allowed.includes(matching.status)) {
          throw new Error(`${spec.id}/${channelKey} has unexpected status ${matching.status}`);
        }
      }
      rows.push({
        id: spec.id,
        channel: channelKey,
        found: Boolean(matching),
        bufferId: matching?.id || null,
        status: matching?.status || null,
        dueAt: matching?.dueAt || spec.dueAt,
        externalLink: matching?.externalLink || null,
      });
    }
  }
  console.log(`AUDIT ${JSON.stringify(rows)}`);
}

function preview() {
  validateManifest();
  validatePublishedAssets();
  const rows = campaign.posts.map((spec) => ({
    id: spec.id,
    dueAt: spec.dueAt,
    asset: mediaUrl(spec),
    channels: spec.channels,
    twitterCharacters: spec.twitter?.length || null,
    instagramCharacters: spec.instagram?.length || null,
  }));
  console.log(JSON.stringify({ campaign: campaign.campaignName, posts: rows }, null, 2));
}

async function main() {
  const actionArg = process.argv.find((arg) => arg.startsWith('--action='));
  const action = actionArg ? actionArg.slice('--action='.length) : 'preview';
  const channelArg = process.argv.find((arg) => arg.startsWith('--channel='));
  const channelKey = channelArg ? channelArg.slice('--channel='.length) : null;
  if (channelKey && !CHANNELS[channelKey]) throw new Error(`Unsupported channel: ${channelKey}`);
  const channelKeys = channelKey ? [channelKey] : Object.keys(CHANNELS);
  if (action === 'preview') return preview();
  if (!['preflight', 'schedule', 'queue-verify', 'audit', 'verify'].includes(action)) {
    throw new Error(`Unsupported action: ${action}`);
  }
  if (action === 'preflight') {
    const { plan } = await preflight({ channelKeys });
    const createCount = plan.filter((row) => row.action === 'create').length;
    const reuseCount = plan.length - createCount;
    console.log(`PREFLIGHT OK: ${createCount} create, ${reuseCount} reuse`);
  }
  if (action === 'schedule') await scheduleCampaign(channelKeys);
  if (action === 'queue-verify') await verifyFutureQueue(channelKeys);
  if (action === 'audit') await audit({ strict: false, channelKeys });
  if (action === 'verify') await audit({ strict: true, channelKeys });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  API,
  CHANNELS,
  COLLISION_WINDOW_MS,
  MIN_SCHEDULE_LEAD_MS,
  NFL_CROSS_LEAGUE_PATTERN,
  ORGANIZATION_ID,
  assertExactPost,
  assertNoCollision,
  findExisting,
  getPost,
  loadChannels,
  listPosts,
  mediaUrl,
  planFutureQueue,
  request,
  resolveImmediatelyBeforeCreate,
  selectFutureSpecs,
  validateManifest,
  validatePublishedAssets,
  verifyMedia,
};
