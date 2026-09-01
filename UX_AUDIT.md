# UX audit — ApprentorBay lifecycle

This audit covers the real learner and mentor journeys, not a visual redesign. The product already had pairing, contracts, evidence, and public profiles. What it lacked was a place that told someone what to do next.

## 1. Major usability problems

### There was no dashboard

Signed-in users landed on the marketing home page. The header sent learners to “My Mentors” and mentors to “My Learners” — a relationship table with no next action. Home copy said “Go to messages” and linked to that same table. After signup, people were sent to an empty profile instead of a first step.

### Empty states were dead ends

Dashboards (and the closest substitutes) went blank when a user had no activity:

- Mentorships: “No active mentorships yet”
- Applications: “No pending applications”

No prompt to complete a profile, browse mentors, define an ambition, or prepare a mentoring listing. New users met an empty room.

### The lifecycle was not visible

How It Works described four generic steps (find a mentor, form a pairing, write the contract, ship a deliverable). It did not name the learner path (Discover → Connect → Agree → Learn → Build → Prove → Showcase) or the mentor path (Be discovered → Connect → Guide → Review → Validate → Build legacy).

The contract workspace already answered “what happens next” for an active pairing. Nothing answered it before a pairing existed, or across several pairings.

### Navigation did not match the work

The header listed every signed-in destination in one row. Learners had no “Dashboard”. Mentors had Applications and My Learners as siblings with no home. Mobile users could not reach the right-hand links without horizontal overflow.

### Status was scattered

Learners could not see, on one screen:

1. What should I do next?
2. Where am I in my learning journey?
3. Who am I waiting for?
4. Which milestone needs attention?
5. What have I achieved?

Mentors could not see pending applications, learners who need them, contracts waiting for review, evidence waiting for review, and completed outcomes together.

### Mobile friction on real workflows

- Display type at 3rem overflowed small viewports.
- Page padding (`px-6 py-16`) wasted phone height.
- Header links sat in one wrapping row with no menu.
- File inputs were native and easy to miss on a phone.
- Tables could squash instead of scroll; admin tables had many action buttons in one cell.
- Modals were centered with tight side padding and no max height, so long admin reason forms could leave the screen.
- Signup role cards sat side by side on a narrow screen.
- Message bubbles used a fixed `max-w-[36rem]` that could overflow a padded column.

## 2. Changes made

### Lifecycle model (derived, not stored)

`shared/domain/lifecycle.ts` derives journey stage and dashboard copy from applications, relationships, contracts, and the existing profile. It reuses `workspaceFocus`, `nextActionCopy`, and `contractProgress`. Nothing new is written to Firestore.

Learner stage priority: Prove → Build → Learn → Agree → Connect → Showcase → Discover.

Mentor stage priority: Validate → Review → Guide → Connect → Build legacy → Be discovered.

The next action can be more urgent than the stage (a guiding mentor still sees “review a pending application” first).

### Learner dashboard (`/dashboard`)

One next-action card, a compact journey rail, waiting-on and milestone cards when there is activity, and a short achievements list. With no activity the journey stays on Discover and the page offers three onboarding actions:

- Complete your profile
- Browse Mentors
- Define your learning ambition

### Mentor dashboard (`/dashboard`)

One next-action card, a compact journey rail, five counts (pending applications, learners needing attention, contracts awaiting review, evidence awaiting review, completed outcomes), and a single work queue. With no activity the journey stays on Be discovered and the page offers:

- Complete your professional profile
- Set availability (mentoring interests — there is no calendar field)
- Prepare your mentoring profile

### Navigation and entry

- Header: Dashboard for learners and mentors; collapsible Menu below the `md` breakpoint.
- Home signed-in CTA: “Open dashboard”.
- Signup and login send learners and mentors to `/dashboard`; admins still go to `/admin`.
- How It Works shows both lifecycle rails and links signed-in users to the dashboard.
- Mentorships and applications keep their tables, add a back link, and gain an onboarding action when empty.

### How It Works copy

The four-step marketing stepper is replaced by the real learner and mentor journeys. The three-parts cards (mentor, learner, deliverable) stay. The pairing / proof cards now follow Discover–Agree and Learn–Showcase.

### Responsive repairs (no new visual language)

- Display type scales down on small screens.
- Page, empty states, and modals use tighter phone padding; modals scroll inside `90vh`.
- Tables keep a minimum width and show “Swipe sideways to see every column” below `md`.
- File uploads use a larger tap target (`FileField`) on profiles and contract evidence.
- Signup role choice stacks on mobile.
- Message bubbles stay inside the column.

The contract workspace, goal builder, and admin tools were not redesigned. They pick up the shared page, modal, table, and file-field fixes.

## 3. Mobile issues fixed

| Area | Problem | Fix |
| --- | --- | --- |
| Header | Overflowing ghost-button row | Menu button; stacked nav below `md` |
| Home / How It Works | 3rem display headline | 2.25rem on small screens, 3rem from `sm` |
| Layout | Large page chrome on phones | `px-4 py-8` then `sm:px-6 sm:py-16` |
| Forms | Role cards side by side | One column on mobile |
| File uploads | Tiny native file control | Full-width dashed tap target |
| Messaging | Bubble wider than column | `max-w-[min(36rem,100%)]` |
| Admin / pairing tables | Columns crushed or clipped | `min-w-[40rem]` + swipe hint |
| Modals | Off-screen footer on phones | Bottom sheet-ish on small screens, scrollable body |
| Dashboards | Five mentor counts as a wide row | 2 / 3 / 5 columns by breakpoint |
| Journey steps | Vertical 7-step block would dominate | Same stepper, `layout="rail"`, wraps |

Tablet (`sm` / `md`) uses the two-column grids and the inline header. Desktop keeps the existing max width (`max-w-5xl`).

## 4. Remaining UX recommendations

These were out of scope or would change the product model.

1. **Real availability.** Mentors still have no calendar or hours field. “Set availability” maps to mentoring interests. A later profile field (and a public “accepting learners” flag) would make Be discovered honest.

2. **Learner application list.** Learners can apply, but they still have no dedicated “my applications” page. The dashboard reports a pending application; the pairing table does not show declined ones.

3. **One pairing vs many.** The dashboard focuses the most urgent contract. A learner with two active pairings will not see both next actions at once. A short “other pairings” line would help without adding a second dashboard.

4. **Contract workspace density.** The operational workspace is still a long page (goal, milestones, evidence, completion, discussion, activity, controls). A sticky next-action bar on mobile would help more than a visual restyle.

5. **Admin tables on a phone.** Horizontal scroll works; it is still a desktop tool. A card list for approval / support rows would be clearer than a scrolled table if admins start working from phones.

6. **Header destinations.** “My Mentors” / “My Learners” were removed from the header in favor of Dashboard. Power users who lived on those lists now click through the dashboard or the pairing counts.

7. **Notifications.** The product has notification types in the domain, but the dashboard does not surface unread notices. Waiting-on copy is derived from the contract, not from a notification inbox.

8. **Restricted accounts.** Restricted or suspended users see a support next action. A dedicated account-status banner on every signed-in page would be clearer than dashboard copy alone.

9. **How It Works current step.** The marketing rails start at step 0 for everyone. A signed-in visitor could see their own current stage on that page; the dashboard already does this.

10. **Evidence upload progress.** FileField improves the tap target. There is still no upload progress, retry, or camera-roll hint for phone users submitting milestone files.

Do not treat this list as a redesign brief. Ship the dashboard and the empty-state paths first; add fields and secondary lists only when a real workflow is blocked.
