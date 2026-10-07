# /plan roadmap

Origin: Antonio Rocha (LinkedIn) suggested profile-driven scoring of events against a person's time and goals. Phase 1 is shipped (PR #27, nav and copy fixes PR #29). Phases 2 and 3 below are the plan, not started.

Constraints that apply to every phase:
- Free to run. No paid API in the request path of a public page.
- One-person operation. Copy on the site is first person ("me", "I"), never "us" or "we".
- Only verified data. Same rule as `offer`, `performers`, `organizer` in `events.json`: set only when confirmed on the event's own site, never guessed. No stubs.
- No em-dashes in copy.

## Phase 1: deterministic planner (shipped)

`/plan`: profile form, scoring (`src/lib/planner.js`, topic 0.45, goal and tier 0.30, proximity 0.15, timing 0.10), greedy trip clustering and itinerary, `.ics` export, share link via URL hash, profile in `localStorage` key `em_plan_profile`. No backend. Tests in `test/planner.test.mjs`.

Known gap: "network" scoring uses event size (tier) only. There is no attendee data. The page says so.

## Phase 2: richer data behind the same page

Goal: make the scores mean more, still static and free.

1. Attendee and speaker signal. Add optional verified fields to `events.json` (candidates: `attendees` estimate, `performers` already exists). Use them in the network and press goals instead of tier alone. Extend `scripts/validate-events.mjs` for the new fields.
2. Price and budget. Use the existing optional `offer` ({price, currency, url?}) so the planner can take a budget cap and show a trip cost estimate. Only events with a verified price are budgeted, others show "price not listed".
3. Discovery prompt. Update `scripts/discover-events-prompt.txt` so the daily run fills these fields only when the event's own site states them, and puts doubtful cases under "Needs manual review".
4. Planner changes stay inside `src/lib/planner.js` with new cases in `test/planner.test.mjs`. Keep scores deterministic.

Done when: a profile with the "network" goal ranks two same-tier events differently based on verified attendee data, and the note about tier-only scoring is removed or narrowed to events lacking data.

Risk: coverage. Most event sites publish no price or speaker list (see the structured data decision in AGENTS.md). Expect sparse fields, so scoring must degrade gracefully to Phase 1 behaviour.

## Phase 3: explainer and saved plans

Goal: plain-language explanation and persistence beyond one browser. This is the first phase with running cost and a backend, so decide the cost question before building.

1. LLM explainer. A button on a generated plan that returns a short "why this trip" paragraph. Runs in the existing Worker as a new route (same pattern as `/api/contact`: Turnstile plus honeypot, validate input, no raw profile stored). Needs an API key as a Worker secret and a hard per-day cap. The deterministic plan remains the source of truth, the LLM only describes it.
2. Saved plans. Optional, only if wanted: server storage (D1 is already on the account) keyed by an unguessable share id rather than accounts. Accounts only if there is a real need, they add auth, privacy and support load for one person.
3. Privacy. Today the profile never leaves the browser, and the page says so. Any step that sends it to a server needs the page copy changed first.

Done when: explainer works behind Turnstile with a daily spend cap, and the privacy line on `/plan` is accurate.

Risk: Cloudflare Free plan limits, and API cost. Do not recommend Workers Paid unless usage nears limits (see Cloudflare notes in the workspace CLAUDE.md).

## Open questions
- Is an attendee estimate obtainable for enough events to matter, or is Phase 2 mostly price data?
- Does Phase 3 justify its running cost, or does Phase 2 plus the deterministic planner suffice?
