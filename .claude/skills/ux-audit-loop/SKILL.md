---
name: ux-audit-loop
description: Walk through a running app the way a first-time user would, record every point of friction, turn the findings into a prioritized fix plan the user approves, then implement the approved items one at a time with verification and a re-test at the end. Use this whenever the user says their app "feels clunky", "is confusing", "isn't user-friendly", asks for a UX audit, usability review, first-time-user test, onboarding review, or asks you to "test it like a real user", "find what's annoying", or "make it easier to use" — even if they only describe the symptom and never say the words "UX" or "usability".
---

# UX Audit Loop

A half-finished product usually doesn't fail because the code is wrong. It fails because
the person using it cannot tell what to do next. Code review catches bugs; nobody catches
confusion. This skill does that pass.

The loop has six phases and they are strictly ordered. The most common way this skill goes
wrong is skipping ahead — fixing something during the walkthrough, or writing the plan
before the walkthrough is finished. Resist that. Observation and repair must stay separate,
because an agent that is already editing files stops noticing friction and starts
rationalizing it.

Report to the user in whatever language they are writing to you in.

---

## Phase 0 — Set up a safe workspace

Do this before touching anything. Later phases modify code; the user needs a clean way back.

1. Check `git status`. If the working tree is dirty, stop and ask the user to commit or
   stash first. Do not commit their unrelated work for them.
2. Create a branch: `git checkout -b ux-audit-<date>`
3. Ask the user (one message, all questions together):
   - How do I start the app locally? (exact command, port, any seed data or test account)
   - Who is the intended user, in one sentence?
   - Which parts are unfinished? — so you don't report "not built yet" as a usability defect
   - Any flows you already know are rough?

If the app cannot be run — no dev command, missing credentials, backend not deployed — say
so plainly and stop. A UX audit from reading source code alone is guesswork, and presenting
guesswork as observation is worse than no audit.

---

## Phase 1 — Choose the flows

Pick the **five** journeys that matter most. Default set for a typical app:

1. First contact — landing or launch, up to the moment the user understands what this is
2. Sign up / first login
3. The one core action the product exists for
4. A second common action, or a settings/profile change
5. An error path — wrong password, empty state, no network, invalid input

Propose the list to the user and let them swap items. Five is deliberate: fewer misses
whole areas, more produces a report nobody reads.

---

## Phase 2 — Walk through as a first-time user

### Tools, in order of preference

| Situation | Use |
| --- | --- |
| Web app, `chrome-devtools` MCP available | Drive the real browser through it |
| Web app, Playwright available | Scripted walkthrough with screenshots at each step |
| ECC installed | The `e2e-runner` agent handles the browser session |
| CLI tool | Run the actual commands in a terminal |
| API only | Call the endpoints with `curl` and read the responses as a consumer would |
| Nothing runnable | Return to Phase 0 and stop |

### The mindset

Play someone who has never seen this product, is mildly impatient, and did not read the
documentation. Do not use knowledge from the codebase while walking. If you know the button
is at the bottom of a collapsed panel, that is exactly the kind of thing a real user does
*not* know — note that you had to know it.

### Record at every step

- What you were trying to do
- What you actually clicked or typed
- How many actions it took
- What the screen told you (or failed to tell you)
- Where you hesitated, guessed, or backtracked
- Errors, blank states, spinners longer than about two seconds
- Take a screenshot at each step where something felt off

### Hard rule for this phase

**Change no code.** Not a typo, not a label, not a CSS value. If you spot an obvious
one-line fix, write it in the notes and keep walking. The moment you start editing, you
lose the fresh-eyes state that makes this phase worth anything, and you cannot get it back
in this session.

### Severity, assigned as you go

| Level | Meaning |
| --- | --- |
| **blocking** | A new user cannot complete the flow, or would quit here |
| **major** | Completable, but confusing or needs an unreasonable number of steps |
| **minor** | Noticeable friction, small cost |
| **polish** | Cosmetic; inconsistent spacing, wording, alignment |

Be strict with `blocking`. If everything is blocking, the ranking carries no information
and the user cannot decide what to do first.

---

## Phase 3 — Write the report

Use this structure exactly:

```markdown
# UX audit — <app name> — <date>

## How I tested
Tool, environment, account used, date. What I could not reach and why.

## Verdict
Three to five sentences. Where does a first-time user get stuck, and what is the single
biggest cause?

## Findings

### [blocking] Short title
- **Flow:** which journey, which step
- **What happened:** observed behaviour only
- **Why it hurts:** the cost to the user
- **Suggested fix:** one or two sentences
- **Evidence:** screenshot path or exact steps to reproduce

(repeat per finding, ordered blocking → polish)

## What already works
Genuinely good things, if any. Not filler — only list what you actually noticed.

## Not verified
Anything you could not reach, and what would be needed to reach it.
```

The "What happened" field is observation, nothing else. Never write that you felt confused
if you did not actually hit a dead end — an invented finding costs the user real work and
teaches them to distrust the whole report. An empty section is an honest result.

---

## Phase 4 — Plan, and wait for approval

Convert the findings to a plan. If ECC is installed:

```
/ecc:plan "Fix the findings in the UX audit report, blocking first."
```

Otherwise write the plan to `ux-audit-plan.md`. Either way, each item needs:

- The finding it comes from
- Files likely touched
- Rough size (small / medium / large)
- How you will know it is fixed — a concrete observable check
- Whether it changes shared components, data, or behaviour other flows depend on

Then **stop and hand the plan to the user.** Ask them to delete, reorder, or veto items.
Some friction is intentional (a confirmation step, a deliberately slow destructive action),
and some fixes cost more than the problem. Only the user knows which.

Do not start Phase 5 before explicit approval. "Looks good" on the whole plan is approval
for the plan's shape, not permission to invent items that were not in it.

---

## Phase 5 — Fix, one item at a time

For each approved item, in order:

1. Restate the item and what "fixed" will look like
2. If the item has testable logic, write the failing test first — or use the
   `tdd-workflow` skill if ECC is installed
3. Implement the smallest change that resolves it
4. Verify against the check from the plan
5. Run the existing test suite; if it breaks, fix that before moving on
6. `git commit` with a message naming the finding
7. Show the user the diff summary and move to the next item

Never batch several items into one commit. When something regresses — and on a half-built
project it will — a per-item history is what makes the cause findable in a minute instead
of an hour.

### Stop and ask the user when

- A fix requires redesigning a flow rather than adjusting it
- A fix touches authentication, payments, permissions, or data migration
- Two findings suggest opposite fixes
- The change turns out much larger than the plan estimated
- You have doubts a fix actually improves things

Stopping to ask costs one message. A wrong autonomous rewrite costs an evening.

---

## Phase 6 — Re-walk

Repeat Phase 2 on the same five flows, with the same fresh-eyes rules.

Write a short closing section:

- Findings confirmed fixed (with evidence)
- Findings still present
- New friction introduced by the fixes — this happens and must be reported, not hidden
- What remains for the next round

---

## Limits worth stating to the user

Say this once, at the end of the first report, in plain words:

An agent walking through an interface finds broken flows, dead ends, missing feedback and
unreasonable step counts. It does not feel boredom, doubt, or mild embarrassment — and
those are what actually make people close a product and not come back. This audit narrows
the list of things worth showing real humans. It does not replace showing them.

Recommend three to five real people for a fifteen-minute session each, watched silently.

---

## Running it again

This is a loop, not a one-off. Good cadence: after each significant feature, and once
before any release. Keep the reports in `docs/ux-audits/` with dates — the trend across
reports tells the user whether the product is getting easier or slowly getting heavier.
