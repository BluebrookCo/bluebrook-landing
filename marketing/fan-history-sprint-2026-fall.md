# Fan-history sprint — rendered, awaiting final queue review

Status: **rendered but fail-closed; do not schedule until the live Buffer queue
passes final collision and channel checks**. The machine-readable campaign is
`fan-history-sprint-2026-fall.json`.

## Why this direction

- Six creatives over two weeks: three per week, cross-posted to X and Instagram.
- Every post has one subject league. NFL posts never borrow SEC framing; SEC
  posts never call college teams “NFL teams.”
- The sequence moves from reply-friendly memory prompts to import behavior,
  differentiated Deep Cuts, and a shareable fan resume.
- No generic score prediction is carrying the campaign. Each post demonstrates
  why a complete attendance history becomes more valuable over time.
- Every asset brief uses original Witnessed ticket geometry and typography and
  expressly excludes team/league logos, player likenesses, broadcast marks, and
  copied competitor treatments.
- Each channel has its own aggregate UTM URL. No per-user or per-event value is
  allowed.

## Approval gate

All six 1080 × 1350 assets have now been rendered and visually reviewed. The
automated checks enforce exact asset membership/dimensions, X and Instagram
copy limits, single-league subject coherence, rights-safe artwork briefs,
chronological spacing, and privacy-safe first-party short links. Those short
links rebuild fixed aggregate UTM labels on `bluebrook.co`; incoming query
parameters cannot override them.

Before scheduling, the still-disabled campaign must pass a live Buffer
preflight: exact connected channel identities, public PNG responses, complete
queue pagination, no record within 45 minutes, and an immediate duplicate
recheck before every create. Only then may `schedulingEnabled` be changed to
`true`. The scheduler must remain create-only—no delete or edit behavior.
