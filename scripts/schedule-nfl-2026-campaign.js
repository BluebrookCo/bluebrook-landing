const campaign = require('../marketing/nfl-2026-kickoff-campaign.json');

const API = 'https://api.buffer.com';
const ORGANIZATION_ID = '6a7f23b911563269b3a59cf8';
const COLLISION_WINDOW_MS = 45 * 60 * 1000;

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

function mediaUrl(spec) {
  return `${campaign.mediaBase}/${spec.asset}`;
}

function specsForChannel(channelKey) {
  return campaign.posts.filter((post) => post.channels.includes(channelKey));
}

function validateManifest() {
  if (!campaign.campaignId || !campaign.mediaBase?.startsWith('https://')) {
    throw new Error('Campaign identity or media base is invalid');
  }
  if (!Array.isArray(campaign.posts) || campaign.posts.length === 0) {
    throw new Error('Campaign has no posts');
  }

  const ids = new Set();
  const assets = new Set();
  const channelTexts = new Set();
  for (const spec of campaign.posts) {
    if (!spec.id || ids.has(spec.id)) throw new Error(`Duplicate or missing post ID: ${spec.id}`);
    ids.add(spec.id);
    if (!spec.asset?.endsWith('.png') || assets.has(spec.asset)) {
      throw new Error(`Duplicate or invalid asset for ${spec.id}`);
    }
    assets.add(spec.asset);
    if (!spec.altText || spec.altText.length > 1000) throw new Error(`Invalid alt text for ${spec.id}`);
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
    }
  }
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

async function listPosts(channelId) {
  const query = `
    query WitnessedCampaignPosts($input: PostsInput!, $first: Int!) {
      posts(input: $input, first: $first) {
        edges {
          node {
            id text status channelId dueAt sentAt externalLink
            error { message supportUrl }
            assets { source mimeType }
          }
        }
      }
    }
  `;
  const data = await request(query, {
    input: {
      organizationId: ORGANIZATION_ID,
      filter: {
        channelIds: [channelId],
        status: ['scheduled', 'sending', 'sent', 'error'],
      },
      sort: [{ field: 'createdAt', direction: 'desc' }],
    },
    first: 100,
  });
  return (data.posts.edges || []).map((edge) => edge.node);
}

function hasExactAsset(post, spec) {
  const expected = mediaUrl(spec);
  return post.assets?.some((asset) => asset.source === expected && asset.mimeType === 'image/png') || false;
}

function assertExactPost(post, channelKey, spec) {
  if (!post) throw new Error(`Missing ${spec.id}/${channelKey}`);
  if (post.text !== spec[channelKey]) throw new Error(`${spec.id}/${channelKey} text drift`);
  if (post.channelId !== CHANNELS[channelKey].id) throw new Error(`${spec.id}/${channelKey} channel drift`);
  if (!hasExactAsset(post, spec)) throw new Error(`${spec.id}/${channelKey} media drift`);
  if (!post.dueAt || new Date(post.dueAt).toISOString() !== spec.dueAt) {
    throw new Error(`${spec.id}/${channelKey} schedule drift`);
  }
}

function findExisting(posts, channelKey, spec) {
  const textMatches = posts.filter((post) => post.text === spec[channelKey]);
  const assetMatches = posts.filter((post) => hasExactAsset(post, spec));
  const combined = [...new Map([...textMatches, ...assetMatches].map((post) => [post.id, post])).values()];
  if (combined.length > 1) throw new Error(`Multiple existing records for ${spec.id}/${channelKey}`);
  if (combined.length === 1) {
    assertExactPost(combined[0], channelKey, spec);
    return combined[0];
  }
  return null;
}

function assertNoCollision(posts, channelKey, spec) {
  const target = new Date(spec.dueAt).getTime();
  const collision = posts.find((post) => {
    if (!post.dueAt || !['scheduled', 'sending'].includes(post.status)) return false;
    return Math.abs(new Date(post.dueAt).getTime() - target) < COLLISION_WINDOW_MS;
  });
  if (collision) {
    throw new Error(
      `${spec.id}/${channelKey} is within 45 minutes of existing ${collision.id} at ${collision.dueAt}`,
    );
  }
}

async function preflight({ requireFuture = true } = {}) {
  validateManifest();
  const channels = await loadChannels();
  for (const expected of Object.values(CHANNELS)) {
    const actual = channels.find((channel) => channel.id === expected.id);
    if (!actual) throw new Error(`Missing ${expected.service} channel`);
    if (actual.name !== expected.name || actual.service !== expected.service) {
      throw new Error(`Channel identity mismatch for ${expected.service}`);
    }
    if (actual.isDisconnected || actual.isLocked || actual.isQueuePaused) {
      throw new Error(`${expected.service} channel is unavailable or paused`);
    }
  }

  await Promise.all(campaign.posts.map((spec) => verifyMedia(mediaUrl(spec))));

  const postsByChannel = {};
  for (const [channelKey, channel] of Object.entries(CHANNELS)) {
    postsByChannel[channelKey] = await listPosts(channel.id);
  }

  const now = Date.now();
  for (const spec of campaign.posts) {
    if (requireFuture && new Date(spec.dueAt).getTime() <= now + 10 * 60 * 1000) {
      throw new Error(`${spec.id} is not at least 10 minutes in the future`);
    }
    for (const channelKey of spec.channels) {
      const existing = findExisting(postsByChannel[channelKey], channelKey, spec);
      if (!existing) assertNoCollision(postsByChannel[channelKey], channelKey, spec);
    }
  }
  return postsByChannel;
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

async function scheduleCampaign() {
  const postsByChannel = await preflight({ requireFuture: true });
  const scheduled = [];
  for (const spec of campaign.posts) {
    for (const channelKey of spec.channels) {
      let post = findExisting(postsByChannel[channelKey], channelKey, spec);
      if (!post) {
        post = await createPost(channelKey, spec);
        postsByChannel[channelKey].push(post);
        console.log(`CREATED ${spec.id}/${channelKey}: ${post.id}`);
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
  }
  console.log(`SCHEDULED ${JSON.stringify(scheduled)}`);
}

async function audit({ strict = false } = {}) {
  validateManifest();
  const rows = [];
  for (const [channelKey, channel] of Object.entries(CHANNELS)) {
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
  if (action === 'preview') return preview();
  if (!['preflight', 'schedule', 'audit', 'verify'].includes(action)) {
    throw new Error(`Unsupported action: ${action}`);
  }
  if (action === 'preflight') {
    await preflight({ requireFuture: true });
    console.log('PREFLIGHT OK');
  }
  if (action === 'schedule') await scheduleCampaign();
  if (action === 'audit') await audit({ strict: false });
  if (action === 'verify') await audit({ strict: true });
}

main().catch((error) => {
  console.error(`FAILED: ${error.message}`);
  process.exitCode = 1;
});
