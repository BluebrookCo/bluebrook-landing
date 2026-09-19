const fs = require('fs');
const path = require('path');

const campaign = require('../marketing/fan-history-sprint-2026-fall.json');
const {
  CHANNELS,
  COLLISION_WINDOW_MS,
  MIN_SCHEDULE_LEAD_MS,
  assertExactPost,
  findExisting,
  getPost,
  listPosts,
  loadChannels,
  mediaUrl,
  planFutureQueue,
  request,
  resolveImmediatelyBeforeCreate,
  selectFutureSpecs,
  verifyMedia,
} = require('./schedule-nfl-2026-campaign');

const CAMPAIGN_ASSET_DIR = path.join(__dirname, '..', campaign.assetDirectory);
const RENDER_SOURCE_PATH = path.join(__dirname, 'render-fan-history-fall-2026.js');
const ALLOWED_LEAGUES = new Set(['nfl', 'sec_cfb']);
const NFL_CROSS_LEAGUE_PATTERN = /#secfootball|\b(?:sec|cfb|college|school|saturdays?)\b/i;
const SEC_CROSS_LEAGUE_PATTERN = /#nfl\b|\bnfl\b|\bpro football\b|\bsundays?\b/i;
const SAFE_CAMPAIGN_ROUTE = /^\/c\/(x|ig)\/fh\d{2}$/;

function weightedXLength(text) {
  const urls = String(text || '').match(/https:\/\/\S+/g) || [];
  return String(text || '').length
    - urls.reduce((total, url) => total + url.length - 23, 0);
}

function validateLeagueCreative(spec) {
  if (!ALLOWED_LEAGUES.has(spec.leagueSubject)) {
    throw new Error(`${spec.id} has an unsupported league subject`);
  }
  const creative = [
    spec.id,
    spec.asset,
    spec.altText,
    spec.assetBrief,
    spec.twitter,
    spec.instagram,
  ].join('\n');
  const forbidden = spec.leagueSubject === 'nfl'
    ? NFL_CROSS_LEAGUE_PATTERN
    : SEC_CROSS_LEAGUE_PATTERN;
  const match = creative.match(forbidden);
  if (match) {
    throw new Error(`${spec.id} mixes ${spec.leagueSubject} with cross-league term: ${match[0]}`);
  }
}

function validateLandingUrl(spec, channelKey) {
  const rawUrl = spec.landingUrls && spec.landingUrls[channelKey];
  let url;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    throw new Error(`${spec.id}/${channelKey} has an invalid landing URL`);
  }
  if (url.origin !== 'https://bluebrook.co' ||
      !SAFE_CAMPAIGN_ROUTE.test(url.pathname) ||
      url.search || url.hash) {
    throw new Error(`${spec.id}/${channelKey} must use a fixed privacy-safe first-party route`);
  }
  const expectedChannel = channelKey === 'twitter' ? 'x' : 'ig';
  if (url.pathname.split('/')[2] !== expectedChannel) {
    throw new Error(`${spec.id}/${channelKey} route channel does not match its destination`);
  }
  if (/user|event|email|handle|@/i.test(url.pathname)) {
    throw new Error(`${spec.id}/${channelKey} route contains a personal-data label`);
  }
}

function validateManifest(subject = campaign, renderSource = null) {
  if (!subject.campaignId || !subject.campaignName ||
      subject.mediaBase !== 'https://bluebrook.co/assets/social/campaigns/fan-history-fall-2026') {
    throw new Error('Campaign identity or media base is invalid');
  }
  if (!Array.isArray(subject.posts) || subject.posts.length !== 6) {
    throw new Error('Fan-history sprint must contain exactly six creatives');
  }

  const ids = new Set();
  const assets = new Set();
  const copyFingerprints = new Set();
  const schedulesByChannel = new Map();
  let previousDueAt = null;

  for (const spec of subject.posts) {
    if (!spec.id || ids.has(spec.id)) throw new Error(`Duplicate or missing post ID: ${spec.id}`);
    ids.add(spec.id);
    if (!spec.asset || !/^\d{2}-[a-z0-9-]+\.png$/.test(spec.asset) || assets.has(spec.asset)) {
      throw new Error(`Duplicate or invalid asset for ${spec.id}`);
    }
    assets.add(spec.asset);
    if (spec.assetStatus !== 'rendered_reviewed' ||
        spec.assetRights !== 'original_geometry_and_typography_only') {
      throw new Error(`${spec.id} has not passed asset and rights review`);
    }
    if (!spec.altText || spec.altText.length < 30 || spec.altText.length > 1000) {
      throw new Error(`Invalid alt text for ${spec.id}`);
    }
    validateLeagueCreative(spec);

    const dueAt = new Date(spec.dueAt);
    if (!Number.isFinite(dueAt.getTime()) || dueAt.toISOString() !== spec.dueAt) {
      throw new Error(`Invalid UTC schedule for ${spec.id}`);
    }
    if (previousDueAt !== null && dueAt.getTime() - previousDueAt < 36 * 60 * 60 * 1000) {
      throw new Error(`${spec.id} is too close to the preceding campaign creative`);
    }
    previousDueAt = dueAt.getTime();

    if (!Array.isArray(spec.channels) || spec.channels.length !== 2 ||
        !spec.channels.includes('twitter') || !spec.channels.includes('instagram')) {
      throw new Error(`${spec.id} must declare both supported campaign channels`);
    }
    for (const channelKey of spec.channels) {
      if (!CHANNELS[channelKey]) throw new Error(`Unsupported channel ${channelKey} for ${spec.id}`);
      const text = spec[channelKey];
      if (!text || !text.trim()) throw new Error(`Missing ${channelKey} copy for ${spec.id}`);
      if (channelKey === 'twitter' && weightedXLength(text) > 280) {
        throw new Error(`${spec.id} exceeds X's weighted 280-character limit`);
      }
      if (channelKey === 'instagram' && text.length > 2200) {
        throw new Error(`${spec.id} exceeds Instagram's caption limit`);
      }
      const fingerprint = `${channelKey}\u0000${text}`;
      if (copyFingerprints.has(fingerprint)) {
        throw new Error(`Duplicate ${channelKey} copy for ${spec.id}`);
      }
      copyFingerprints.add(fingerprint);
      validateLandingUrl(spec, channelKey);

      if (channelKey === 'twitter' && !text.includes(spec.landingUrls.twitter)) {
        throw new Error(`${spec.id} X copy does not contain its fixed campaign route`);
      }
      if (channelKey === 'instagram' && /https?:\/\//.test(text)) {
        throw new Error(`${spec.id} Instagram caption must use the profile link, not a raw URL`);
      }

      const channelSchedule = schedulesByChannel.get(channelKey) || [];
      channelSchedule.push({ id: spec.id, dueAt: dueAt.getTime() });
      schedulesByChannel.set(channelKey, channelSchedule);
    }
  }

  for (const [channelKey, channelSchedule] of schedulesByChannel.entries()) {
    channelSchedule.sort((left, right) => left.dueAt - right.dueAt);
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
  if (/\b(?:Momento|Kopio|Footbeen|Gamebook|BoxdSeats)\b/i.test(source)) {
    throw new Error('Rendered artwork source names a competitor');
  }
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
  for (const asset of expected) {
    const bytes = fs.readFileSync(path.join(assetDir, asset));
    if (bytes.subarray(1, 4).toString('ascii') !== 'PNG' ||
        bytes.readUInt32BE(16) !== 1080 || bytes.readUInt32BE(20) !== 1350) {
      throw new Error(`${asset} is not the reviewed 1080x1350 PNG format`);
    }
  }
}

function assertSchedulingEnabled(subject = campaign) {
  if (subject.schedulingEnabled !== true || subject.status !== 'approved_for_scheduling') {
    throw new Error('Campaign scheduling is disabled pending final queue review');
  }
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
  await Promise.all(futureSpecs.map((spec) => verifyMedia(mediaUrl(spec, campaign))));
  const postsByChannel = {};
  for (const channelKey of channelKeys) {
    postsByChannel[channelKey] = await listPosts(CHANNELS[channelKey].id);
  }
  const plan = planFutureQueue(postsByChannel, {
    subject: campaign,
    channelKeys,
    nowMs,
    minLeadMs,
  });
  return { futureSpecs, plan, postsByChannel };
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
        url: mediaUrl(spec, campaign),
        metadata: { altText: spec.altText },
      },
    }],
  };
  if (channelKey === 'instagram') {
    input.metadata = { instagram: { type: 'post', shouldShareToFeed: true } };
  }
  const mutation = `
    mutation WitnessedFanHistoryCreatePost($input: CreatePostInput!) {
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

async function scheduleCampaign(channelKeys) {
  // This gate runs before credentials, network reads, or mutations. A render
  // commit alone can therefore never publish or schedule the campaign.
  assertSchedulingEnabled();
  const { plan } = await preflight({ channelKeys });
  const scheduled = [];
  for (const row of plan) {
    const { spec, channelKey } = row;
    let post = row.post;
    let action = 'reuse';
    if (!post) {
      const resolved = await resolveImmediatelyBeforeCreate({
        channelKey,
        spec,
        subject: campaign,
        createPostFn: createPost,
      });
      post = resolved.post;
      action = resolved.action;
    }
    const verified = await getPost(post.id);
    assertExactPost(verified, channelKey, spec, campaign);
    if (verified.status === 'error') {
      throw new Error(`${spec.id}/${channelKey} failed: ${verified.error?.message || 'unknown error'}`);
    }
    if (verified.status !== 'scheduled') {
      throw new Error(`${spec.id}/${channelKey} has unexpected status ${verified.status}`);
    }
    scheduled.push({
      id: spec.id,
      channel: channelKey,
      action,
      bufferId: verified.id,
      dueAt: verified.dueAt,
    });
    console.log(`${action.toUpperCase()}+VERIFIED ${spec.id}/${channelKey}: ${verified.id}`);
  }
  console.log(`SCHEDULED ${JSON.stringify(scheduled)}`);
}

async function audit({ strict = false, channelKeys = Object.keys(CHANNELS) } = {}) {
  validateManifest();
  validatePublishedAssets();
  const rows = [];
  for (const channelKey of channelKeys) {
    const posts = await listPosts(CHANNELS[channelKey].id);
    for (const spec of campaign.posts.filter((post) => post.channels.includes(channelKey))) {
      const matching = findExisting(posts, channelKey, spec, campaign);
      if (strict && !matching) throw new Error(`Missing ${spec.id}/${channelKey}`);
      if (matching) assertExactPost(matching, channelKey, spec, campaign);
      rows.push({
        id: spec.id,
        channel: channelKey,
        found: Boolean(matching),
        bufferId: matching?.id || null,
        status: matching?.status || null,
        dueAt: matching?.dueAt || spec.dueAt,
      });
    }
  }
  console.log(`AUDIT ${JSON.stringify(rows)}`);
}

function preview() {
  validateManifest();
  validatePublishedAssets();
  console.log(JSON.stringify({
    campaign: campaign.campaignName,
    status: campaign.status,
    schedulingEnabled: campaign.schedulingEnabled,
    posts: campaign.posts.map((spec) => ({
      id: spec.id,
      leagueSubject: spec.leagueSubject,
      dueAt: spec.dueAt,
      asset: mediaUrl(spec, campaign),
      channels: spec.channels,
      twitterWeightedCharacters: weightedXLength(spec.twitter),
      instagramCharacters: spec.instagram.length,
    })),
  }, null, 2));
}

async function main() {
  const actionArg = process.argv.find((arg) => arg.startsWith('--action='));
  const action = actionArg ? actionArg.slice('--action='.length) : 'preview';
  const channelArg = process.argv.find((arg) => arg.startsWith('--channel='));
  const channelKey = channelArg ? channelArg.slice('--channel='.length) : null;
  if (channelKey && !CHANNELS[channelKey]) throw new Error(`Unsupported channel: ${channelKey}`);
  const channelKeys = channelKey ? [channelKey] : Object.keys(CHANNELS);

  if (action === 'preview') return preview();
  if (!['preflight', 'schedule', 'audit', 'verify'].includes(action)) {
    throw new Error(`Unsupported action: ${action}`);
  }
  if (action === 'preflight') {
    const { plan } = await preflight({ channelKeys });
    const createCount = plan.filter((row) => row.action === 'create').length;
    console.log(`PREFLIGHT OK: ${createCount} create, ${plan.length - createCount} reuse`);
  }
  if (action === 'schedule') await scheduleCampaign(channelKeys);
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
  NFL_CROSS_LEAGUE_PATTERN,
  SEC_CROSS_LEAGUE_PATTERN,
  assertSchedulingEnabled,
  createPost,
  preflight,
  scheduleCampaign,
  validateLandingUrl,
  validateLeagueCreative,
  validateManifest,
  validatePublishedAssets,
  weightedXLength,
};
