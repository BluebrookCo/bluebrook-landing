const test = require('node:test');
const assert = require('node:assert/strict');

const campaign = require('../marketing/nfl-2026-kickoff-campaign.json');
const { validateManifest } = require('./schedule-nfl-2026-campaign');

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
