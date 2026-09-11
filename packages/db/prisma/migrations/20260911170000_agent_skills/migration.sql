-- CreateTable
CREATE TABLE "agentSkill" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "defaultBody" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agentSkill_pkey" PRIMARY KEY ("slug")
);

-- Seed with the skills shipped in the agent
INSERT INTO "agentSkill" ("slug", "title", "description", "body", "defaultBody", "updatedAt") VALUES
('box-lunch', 'Box lunch', 'Load when working a project toward an AIA box lunch — who to write to, in what order, on what rhythm, and when to hand the scheduling to the office manager. Uses John''s templates.', '---
description: Load when working a project toward an AIA box lunch — who to write to, in what order, on what rhythm, and when to hand the scheduling to the office manager. Uses John''s templates.
---

# Box lunch

The goal is a lunch presentation in the architect''s office, in front of the
people who will detail this building. Everything else is a step toward that.

## Who, in order

1. **The project architect** on this project, about this project. If John
   assigned someone on the project, that is the person. If not, the firm''s
   team page usually names one (`read_website`); record it with
   `add_project_participant` before writing.
2. **The principal or studio lead** if the project architect is silent after
   two touches.
3. **The office manager or marketing coordinator** to schedule, once anyone
   has said yes — or after the second silence, to ask who books lunches.

Never write to more than one person at the firm on the same day.

## Rhythm

- Touch 1: the intro (template "Project architect — box lunch intro"). It
  names the project and asks for twenty minutes.
- Day 5, no reply: one short follow-up on the same thread. Two sentences.
  Reference the project, offer two dates.
- Day 12, still nothing: switch person (principal, then office manager with
  "Office manager — who books lunches?").
- A reply of any kind resets the clock and changes the next step; log what
  they said on the project.
- After a yes: confirm the date and headcount, ask whether they want the
  elevator-lobby talk or the general one, and put the presentation on the
  **Field Planner** calendar with `create_event`, not the CRM calendar. It
  is a place John has to be.
- T-7: to-do for John to send materials and confirm headcount.
- After the lunch: John logs the sign-in sheet through CertEngine; the
  attendees arrive in the CRM with a dated meeting. Then this skill''s job on
  the project is done and `quote-cadence` takes over when a quote appears.

## What a good answer looks like

The best outcome of the first email is not a booked lunch; it is a named
person saying "talk to X about that". Treat a redirect as progress: record
X, thank the sender in one line, write to X.

## What not to do

- Do not pitch the product in the intro. The intro sells twenty minutes.
- Do not attach anything.
- Do not email a firm John presented at in the last six months without
  checking the company''s meetings first (`read_company_history`); if he was
  just there, the ask is different: "here''s a project of yours I noticed", not
  "may I come present".
- Do not schedule anything on John''s calendar without a yes from the firm.
', '---
description: Load when working a project toward an AIA box lunch — who to write to, in what order, on what rhythm, and when to hand the scheduling to the office manager. Uses John''s templates.
---

# Box lunch

The goal is a lunch presentation in the architect''s office, in front of the
people who will detail this building. Everything else is a step toward that.

## Who, in order

1. **The project architect** on this project, about this project. If John
   assigned someone on the project, that is the person. If not, the firm''s
   team page usually names one (`read_website`); record it with
   `add_project_participant` before writing.
2. **The principal or studio lead** if the project architect is silent after
   two touches.
3. **The office manager or marketing coordinator** to schedule, once anyone
   has said yes — or after the second silence, to ask who books lunches.

Never write to more than one person at the firm on the same day.

## Rhythm

- Touch 1: the intro (template "Project architect — box lunch intro"). It
  names the project and asks for twenty minutes.
- Day 5, no reply: one short follow-up on the same thread. Two sentences.
  Reference the project, offer two dates.
- Day 12, still nothing: switch person (principal, then office manager with
  "Office manager — who books lunches?").
- A reply of any kind resets the clock and changes the next step; log what
  they said on the project.
- After a yes: confirm the date and headcount, ask whether they want the
  elevator-lobby talk or the general one, and put the presentation on the
  **Field Planner** calendar with `create_event`, not the CRM calendar. It
  is a place John has to be.
- T-7: to-do for John to send materials and confirm headcount.
- After the lunch: John logs the sign-in sheet through CertEngine; the
  attendees arrive in the CRM with a dated meeting. Then this skill''s job on
  the project is done and `quote-cadence` takes over when a quote appears.

## What a good answer looks like

The best outcome of the first email is not a booked lunch; it is a named
person saying "talk to X about that". Treat a redirect as progress: record
X, thank the sender in one line, write to X.

## What not to do

- Do not pitch the product in the intro. The intro sells twenty minutes.
- Do not attach anything.
- Do not email a firm John presented at in the last six months without
  checking the company''s meetings first (`read_company_history`); if he was
  just there, the ask is different: "here''s a project of yours I noticed", not
  "may I come present".
- Do not schedule anything on John''s calendar without a yes from the firm.
', now()),
('data-boundaries', 'What you may read, and what may leave', 'Use before reading CRM history or sending anything to a third party — what this agent may read (all of it) and what may leave.', '---
description: Use before reading CRM history or sending anything to a third party — what this agent may read (all of it) and what may leave.
---

# What you may read, and what may leave

## You may read everything

This is a single-tenant internal CRM. Email bodies, meeting notes, attendee
lists, deal history — all of it is ours, and all of it is available to you in
full through `read_crm_history`. There is no redaction to work around and no
approval to seek.

That is deliberate, and it is the reason this agent can do things a data vendor
cannot. A signature block settles a job title more reliably than LinkedIn does,
because people update a signature the week they are promoted. A reply on a
thread proves an identity outright. Use them.

## The boundary is egress

Three rules, and they are about what leaves, not what you look at.

**1. No customer text in a third-party query.** `web_search`, `web_fetch` and
`research_person` go to companies that are not us. Ask them derived questions —
"what did Acme announce in 2026?" — never a pasted thread, quote, or sentence
from a message. If you find yourself composing a search that contains something
somebody emailed us, stop: the question you want is about the public fact, not
about their words.

**2. Nothing from a mailbox goes into `/workspace`.** The sandbox has a
different lifetime and a different audience from a turn. Dossiers of public
profile data are what it is for. Message bodies stay in the conversation.

**3. Nothing sensitive gets logged.** Same rule the rest of the codebase
follows. Reading is not logging.

## What belongs on a record

Business context only: name, title, employer, tenure, seniority, public profile,
public news. Nothing about a person outside their work, and none of the special
categories — health, politics, religion, sexuality, ethnicity, union membership
— regardless of what a source volunteers or an endpoint returns.

If something is interesting but personal, it does not go on the record. A CRM
that knows a customer''s marathon time is a CRM somebody has to explain.
', '---
description: Use before reading CRM history or sending anything to a third party — what this agent may read (all of it) and what may leave.
---

# What you may read, and what may leave

## You may read everything

This is a single-tenant internal CRM. Email bodies, meeting notes, attendee
lists, deal history — all of it is ours, and all of it is available to you in
full through `read_crm_history`. There is no redaction to work around and no
approval to seek.

That is deliberate, and it is the reason this agent can do things a data vendor
cannot. A signature block settles a job title more reliably than LinkedIn does,
because people update a signature the week they are promoted. A reply on a
thread proves an identity outright. Use them.

## The boundary is egress

Three rules, and they are about what leaves, not what you look at.

**1. No customer text in a third-party query.** `web_search`, `web_fetch` and
`research_person` go to companies that are not us. Ask them derived questions —
"what did Acme announce in 2026?" — never a pasted thread, quote, or sentence
from a message. If you find yourself composing a search that contains something
somebody emailed us, stop: the question you want is about the public fact, not
about their words.

**2. Nothing from a mailbox goes into `/workspace`.** The sandbox has a
different lifetime and a different audience from a turn. Dossiers of public
profile data are what it is for. Message bodies stay in the conversation.

**3. Nothing sensitive gets logged.** Same rule the rest of the codebase
follows. Reading is not logging.

## What belongs on a record

Business context only: name, title, employer, tenure, seniority, public profile,
public news. Nothing about a person outside their work, and none of the special
categories — health, politics, religion, sexuality, ethnicity, union membership
— regardless of what a source volunteers or an endpoint returns.

If something is interesting but personal, it does not go on the record. A CRM
that knows a customer''s marathon time is a CRM somebody has to explain.
', now()),
('drafting-for-john', 'Drafting for John', 'Load before drafting any email with draft_email. How John McPhail writes, what he never writes, and when the agent may draft at all.', '---
description: Load before drafting any email with draft_email. How John McPhail writes, what he never writes, and when the agent may draft at all.
---

# Drafting for John

Every draft lands in John''s Gmail Drafts. He reads it and sends it, or he
rewrites it. The measure of a good draft is that he sends it without touching
it. The measure of a bad one is that it sounds like a machine.

## When to draft

- A distributor has gone quiet past the cadence on a quote (bid date plus two
  weeks with nothing, then thirty days, then sixty). Draft the check-in.
- A project John qualified has a named project architect and no outreach yet.
  Draft the introduction about that project.
- Outreach stalled and the firm has an office manager or coordinator. Draft the
  "who books your box lunches?" note.
- John asked you to.

Do not draft to someone you cannot name. Do not draft a second email to the
same person inside seven days unless John asked. Never send anything; there is
no send tool on purpose.

## Who John is, in one line

Twenty-plus years in fire and life safety, five hundred AIA presentations,
smoke and fire curtains for Stöbich. He is warm first and direct second, and
the order matters.

## Voice

Warm, human, a little funny when the moment allows, and clear about what he
wants. He sounds like someone you would enjoy coffee with who also knows his
subject cold. He is never choosing between likable and credible; he is both in
the same sentence.

Openings: skip the throat-clearing. No "I hope this finds you well," no "I''m
writing to." Open with who he is and why he is reaching out, warmly. A line
that names the cold call does real work: "I know you don''t know me from Adam."
"I just left a voicemail with your office."

Body: short, every sentence earning its place, but never trimmed so hard the
humanity goes. Real paragraphs, not a stack of one-line fragments. Vary
sentence length like people talk. State credentials plainly, no apology and no
bragging, delivered like a person and not a résumé.

Closings: a low-friction next step, or a friendly redirect ("If I''ve got the
wrong person, would you point me the right way?"), or a warm sign-off and a
stop. Not "I look forward to hearing from you." Not "Please let me know if
this works for you."

Sign as John McPhail. No title block, no fanfare.

## Hard rules

- No em dashes. Use commas or periods.
- Colons only to introduce an actual list or a "see below." Never mid-sentence.
- Never "curtain installer." It is "curtain provider."
- Never "debate" for an industry misunderstanding. It is a misunderstanding.
- No stock reframes: "It''s not X, it''s Y." "The question isn''t X." "This isn''t a
  tool, it''s a system."
- No dramatic pivots: "here''s the thing," "here''s the kicker," "here''s where it
  gets interesting."
- No dead transitions: furthermore, additionally, moreover, that said, with that
  in mind, moving forward, at the end of the day.
- No bloated verbs: serves as, stands as, boasts, features, plays a role in,
  aims to. Use is, has, uses, gives, shows.
- No engagement bait, ever.
- Banned words: delve, realm, harness, unlock, leverage, synergy, innovative,
  game-changer, seamless, robust, streamline, elevate, empower, cutting-edge,
  transformative, holistic, proactive, mission-critical, unprecedented,
  intuitive, dynamic, foster, showcase, enhance, optimize, scalable, pivotal,
  crucial, testament, underscore, vibrant, meticulously.

## Protect, do not "fix"

These are not hedging. They are the point. Keep them.

- "I know you don''t know me."
- "I''m not sure if that''s you, but…"
- "Appreciate you making it to the bottom of this."
- "If that''s something your team does…"
- "Happy to talk through options."

Smooth only the phrases that undersell him: "I believe I can," "I''m pretty
sure," "I hope this helps," "I would love to," "I''m fairly confident."

## Shape of the three common drafts

Distributor check-in: one short paragraph. Name the project and the bid date.
Ask where it landed with the GC, and specifically whether the estimator gave
any read after bid day. One question, easy to answer in a sentence.

Project architect intro: three short paragraphs. Who John is and that he saw
the project (name it, and say where: city, stage if known). One line on why a
smoke curtain conversation is worth twenty minutes for that building type. The
box lunch offer, with the out: if lunch is not his call, who is?

Office manager: two or three sentences. Who John is, that he does AIA lunch
presentations, and who at the office handles scheduling those. Warm, brief,
nothing to decide.

## Templates first

Call `list_templates` before writing. If one matches the situation (its
"when to use it" line tells you), use its subject and body and fill the
placeholders from the record: {{firstName}}, {{firm}}, {{project}},
{{city}}, {{bidDate}} and so on. Adjust one or two words so it reads true for
this person, no more. A template is John''s own wording; the rules below are
already baked into it. Only write from scratch when no template fits.

## Before you call draft_email

Read the draft once as the recipient. Would they want to reply? Does it sound
like a person they would like? If it only sounds efficient, it is not done.
', '---
description: Load before drafting any email with draft_email. How John McPhail writes, what he never writes, and when the agent may draft at all.
---

# Drafting for John

Every draft lands in John''s Gmail Drafts. He reads it and sends it, or he
rewrites it. The measure of a good draft is that he sends it without touching
it. The measure of a bad one is that it sounds like a machine.

## When to draft

- A distributor has gone quiet past the cadence on a quote (bid date plus two
  weeks with nothing, then thirty days, then sixty). Draft the check-in.
- A project John qualified has a named project architect and no outreach yet.
  Draft the introduction about that project.
- Outreach stalled and the firm has an office manager or coordinator. Draft the
  "who books your box lunches?" note.
- John asked you to.

Do not draft to someone you cannot name. Do not draft a second email to the
same person inside seven days unless John asked. Never send anything; there is
no send tool on purpose.

## Who John is, in one line

Twenty-plus years in fire and life safety, five hundred AIA presentations,
smoke and fire curtains for Stöbich. He is warm first and direct second, and
the order matters.

## Voice

Warm, human, a little funny when the moment allows, and clear about what he
wants. He sounds like someone you would enjoy coffee with who also knows his
subject cold. He is never choosing between likable and credible; he is both in
the same sentence.

Openings: skip the throat-clearing. No "I hope this finds you well," no "I''m
writing to." Open with who he is and why he is reaching out, warmly. A line
that names the cold call does real work: "I know you don''t know me from Adam."
"I just left a voicemail with your office."

Body: short, every sentence earning its place, but never trimmed so hard the
humanity goes. Real paragraphs, not a stack of one-line fragments. Vary
sentence length like people talk. State credentials plainly, no apology and no
bragging, delivered like a person and not a résumé.

Closings: a low-friction next step, or a friendly redirect ("If I''ve got the
wrong person, would you point me the right way?"), or a warm sign-off and a
stop. Not "I look forward to hearing from you." Not "Please let me know if
this works for you."

Sign as John McPhail. No title block, no fanfare.

## Hard rules

- No em dashes. Use commas or periods.
- Colons only to introduce an actual list or a "see below." Never mid-sentence.
- Never "curtain installer." It is "curtain provider."
- Never "debate" for an industry misunderstanding. It is a misunderstanding.
- No stock reframes: "It''s not X, it''s Y." "The question isn''t X." "This isn''t a
  tool, it''s a system."
- No dramatic pivots: "here''s the thing," "here''s the kicker," "here''s where it
  gets interesting."
- No dead transitions: furthermore, additionally, moreover, that said, with that
  in mind, moving forward, at the end of the day.
- No bloated verbs: serves as, stands as, boasts, features, plays a role in,
  aims to. Use is, has, uses, gives, shows.
- No engagement bait, ever.
- Banned words: delve, realm, harness, unlock, leverage, synergy, innovative,
  game-changer, seamless, robust, streamline, elevate, empower, cutting-edge,
  transformative, holistic, proactive, mission-critical, unprecedented,
  intuitive, dynamic, foster, showcase, enhance, optimize, scalable, pivotal,
  crucial, testament, underscore, vibrant, meticulously.

## Protect, do not "fix"

These are not hedging. They are the point. Keep them.

- "I know you don''t know me."
- "I''m not sure if that''s you, but…"
- "Appreciate you making it to the bottom of this."
- "If that''s something your team does…"
- "Happy to talk through options."

Smooth only the phrases that undersell him: "I believe I can," "I''m pretty
sure," "I hope this helps," "I would love to," "I''m fairly confident."

## Shape of the three common drafts

Distributor check-in: one short paragraph. Name the project and the bid date.
Ask where it landed with the GC, and specifically whether the estimator gave
any read after bid day. One question, easy to answer in a sentence.

Project architect intro: three short paragraphs. Who John is and that he saw
the project (name it, and say where: city, stage if known). One line on why a
smoke curtain conversation is worth twenty minutes for that building type. The
box lunch offer, with the out: if lunch is not his call, who is?

Office manager: two or three sentences. Who John is, that he does AIA lunch
presentations, and who at the office handles scheduling those. Warm, brief,
nothing to decide.

## Templates first

Call `list_templates` before writing. If one matches the situation (its
"when to use it" line tells you), use its subject and body and fill the
placeholders from the record: {{firstName}}, {{firm}}, {{project}},
{{city}}, {{bidDate}} and so on. Adjust one or two words so it reads true for
this person, no more. A template is John''s own wording; the rules below are
already baked into it. Only write from scratch when no template fits.

## Before you call draft_email

Read the draft once as the recipient. Would they want to reply? Does it sound
like a person they would like? If it only sounds efficient, it is not done.
', now()),
('evidence', 'Evidence', 'Use when recording a fact — picking the right evidence kind for what you actually saw, and understanding why a claim was written, offered or held.', '---
description: Use when recording a fact — picking the right evidence kind for what you actually saw, and understanding why a claim was written, offered or held.
---

# Evidence

You never set a confidence. You report what you saw, and the ledger prices it.
Getting the `kind` right is therefore the whole job — it is the difference
between a fact landing on a record and a rep being asked a question.

## The kinds, and what each one means

**Primary — these can carry a fact on their own.** All of them are a source
identifying *this person*, not merely being consistent with them.

| Kind | Use it when |
| --- | --- |
| `profile.email-match` | The profile itself shows the address we hold. Decisive. |
| `linkedin.employer-and-name` | A LinkedIn profile where the employer matches *and* the name is consistent with the address. Both, or it is not this. |
| `crm.thread-reply` | They replied, from that address, on a thread we synced. Proof of identity. |
| `crm.signature-block` | Their own signature states it. The best source there is for a job title. |
| `github.account-identity` | The GitHub account''s own `name` (or name plus company) matches. |
| `crm.meeting-attendance` | They accepted a calendar invite we have. |

**Supporting — true, but not enough alone.**

| Kind | Use it when |
| --- | --- |
| `web.cited-claim` | A page states it and you have the URL. |
| `search.cites-profile` | A search for them by name and employer returned this profile. |
| `handle.name-form` | The handle is a construction of their name. Weak: `github.com/lewis` is a form of every Lewis''s name. |
| `employer-only` | The employer matches but the name does not. Nearly worthless on its own, and deliberately so — this is how a colleague gets filed as the contact. |

**`contradiction` — when two sources disagree.**

Record it. It does not lower the score a little; it holds the fact entirely,
which is correct. A profile saying one employer and a mail header saying another
is not 60% true, it is unresolved, and a rep should see it that way.

## What good evidence looks like

One entry per **independent** source. Two things on the same page are one
observation, not two: a GitHub profile whose name and company both match is one
`github.account-identity`, not a name match plus a company match. Splitting it
would double-count a single page into false certainty, which is exactly the
arithmetic this system exists to avoid.

`detail` is read by a rep in a tooltip. Write it for them:

- Good: `their signature on 14 July reads "Head of Security, Acme"`
- Bad: `signature match confirmed`

## What happens next, so you can stop guessing about it

- Primary source and a high score → **written to the record.**
- Otherwise → **stored as a suggestion** under the empty field, for a rep.
- Weak → kept but never shown.
- Nothing → not stored.

A suggestion is a good outcome. It is often the *correct* outcome: four Marchettis
work at Fernhill and a human settles that in three seconds. Do not go looking for
extra evidence to push a claim over a line — that is how a wrong answer gets
dressed up as a right one.
', '---
description: Use when recording a fact — picking the right evidence kind for what you actually saw, and understanding why a claim was written, offered or held.
---

# Evidence

You never set a confidence. You report what you saw, and the ledger prices it.
Getting the `kind` right is therefore the whole job — it is the difference
between a fact landing on a record and a rep being asked a question.

## The kinds, and what each one means

**Primary — these can carry a fact on their own.** All of them are a source
identifying *this person*, not merely being consistent with them.

| Kind | Use it when |
| --- | --- |
| `profile.email-match` | The profile itself shows the address we hold. Decisive. |
| `linkedin.employer-and-name` | A LinkedIn profile where the employer matches *and* the name is consistent with the address. Both, or it is not this. |
| `crm.thread-reply` | They replied, from that address, on a thread we synced. Proof of identity. |
| `crm.signature-block` | Their own signature states it. The best source there is for a job title. |
| `github.account-identity` | The GitHub account''s own `name` (or name plus company) matches. |
| `crm.meeting-attendance` | They accepted a calendar invite we have. |

**Supporting — true, but not enough alone.**

| Kind | Use it when |
| --- | --- |
| `web.cited-claim` | A page states it and you have the URL. |
| `search.cites-profile` | A search for them by name and employer returned this profile. |
| `handle.name-form` | The handle is a construction of their name. Weak: `github.com/lewis` is a form of every Lewis''s name. |
| `employer-only` | The employer matches but the name does not. Nearly worthless on its own, and deliberately so — this is how a colleague gets filed as the contact. |

**`contradiction` — when two sources disagree.**

Record it. It does not lower the score a little; it holds the fact entirely,
which is correct. A profile saying one employer and a mail header saying another
is not 60% true, it is unresolved, and a rep should see it that way.

## What good evidence looks like

One entry per **independent** source. Two things on the same page are one
observation, not two: a GitHub profile whose name and company both match is one
`github.account-identity`, not a name match plus a company match. Splitting it
would double-count a single page into false certainty, which is exactly the
arithmetic this system exists to avoid.

`detail` is read by a rep in a tooltip. Write it for them:

- Good: `their signature on 14 July reads "Head of Security, Acme"`
- Bad: `signature match confirmed`

## What happens next, so you can stop guessing about it

- Primary source and a high score → **written to the record.**
- Otherwise → **stored as a suggestion** under the empty field, for a rep.
- Weak → kept but never shown.
- Nothing → not stored.

A suggestion is a good outcome. It is often the *correct* outcome: four Marchettis
work at Fernhill and a human settles that in three seconds. Do not go looking for
extra evidence to push a claim over a line — that is how a wrong answer gets
dressed up as a right one.
', now()),
('identity-matching', 'Identity matching', '', '---
name: identity-matching
description: How to decide that a LinkedIn profile is the person behind a CRM email address, and when to refuse.
---

# Identity matching

You are given an email address and a company. You need the person. Getting this
wrong writes a stranger''s career onto a customer''s record, so the procedure is
built to fail closed.

## Why the obvious approach does not work

`pmarchetti@fernhill.com` is not a name. Searching for it directly returns nothing.
Asking a model what it stands for produces "Paula Marchetti" — which happens to be
right, and would have been just as confident had it been wrong. You cannot tell
the difference afterwards, which is why guessing is banned outright.

What works is handing over every clue you already hold — the address itself, the
name on the record, the employer and its domain — and letting the resolver match
them against real profiles. The clues go into the **query**, and the answer comes
from the profile.

That is the shape of every match: say where to look, never what you will find.

## The procedure

0. **`read_crm_history` first.** It is free and it is often decisive. If they
   have ever replied to us from that address, you already have the strongest
   evidence available anywhere — `crm.thread-reply` — and a signature block may
   hand you their title as well. Start every match here, not at a search engine.
1. **`resolve_linkedin_profile`** when the record holds no LinkedIn URL. Pass the
   email, the company name and domain, and any first and last name the CRM has.
   It returns one candidate and a verdict. A candidate is a lead, not an answer.
2. **`get_linkedin_profile`** when the record already holds a LinkedIn URL, or to
   check a candidate at a different URL. Pass the email, company name
   and domain — **and the `contactId`**. It returns the profile, their full work
   history *and a verdict*, in one lookup. Passing the id is what lets it copy
   their photograph, which it does only if the verdict comes back positive, in
   code, without asking you. Leaving it out costs the contact their picture and
   saves nothing.

   Both calls cost the same, and they are the most expensive you have. Two or
   three lookups is the whole budget for a contact, so do not run both when one
   answers. A record with a LinkedIn URL needs step 2 only.
3. **Read the verdict, not the profile.** It checks three things:
   - `emailMatches` — the profile lists the address we are identifying.
   - `employerMatches` — a current position matches the company we have.
   - `nameMatches` — the real name is consistent with the email local part
     (`y` + `okonkwo` → Tomi Okonkwo).
4. **`emailMatches` settles it on its own.** The person put that address on their
   own profile. Nothing else you can observe is stronger.
5. **Otherwise both, or it is not them.** One of the other two is not a weaker
   match, it is a different person who happens to share something.
6. If no candidate passes, **stop**. Leaving "Pmarchetti" in the CRM is the correct
   outcome when you do not know.

Somebody whose LinkedIn URL is **already on the record** has been through all of
this before. Do not re-run it to get a picture — `fetch_contact_photo` is one
call, and the URL sitting there is the verification.

## Reporting the match

Call `identify_contact` with what you actually saw:

| What you have | Evidence to record | What happens |
| --- | --- | --- |
| `emailMatches` is true | `profile.email-match` | Written to the record. |
| Employer and name both pass | `linkedin.employer-and-name` | Written to the record. |
| They replied from that address | `crm.thread-reply` | Written to the record. |
| One check passes | `employer-only`, or the profile as `search.cites-profile` | Offered to a rep as a suggestion. |
| Sources disagree | add a `contradiction` entry | Held. Nobody is shown a guess. |

The `sourceUrl` to cite is the one the tool hands back — the profile URL the
person''s own record lists. A lookup that comes back with no source is a lookup
you cannot write a fact from.

The `One check passes` row is the case this exists for. Four Marchettis work at Fernhill; a
human settles that in three seconds, and the old rule — throw away anything
short of certain — meant we paid for that lookup every run and learned nothing
from it. A suggestion is not a failed match. It is the match, handed to the one
person who can finish it.

Do not add evidence you did not observe to push a claim over a line.

## Things that look like evidence and are not

- **A search result.** Search says where to look. A query for "Paula Marchetti"
  once returned Brightwater''s CEO, an HR lead at Reply, and a data engineer in
  Seattle — all with total confidence.
- **A matching first name.** Half the Chrises at a company are not your Chris.
  The surname or the employer has to carry it.
- **Perplexity''s view of somebody''s job title.** It aggregates stale sources; it
  said "Account Executive L3" for a profile that reads "Growth Specialist at
  Fernhill". For identity, the person''s own profile wins.
- **A very plausible expansion.** `jsmith` is probably J. Smith. Probably is not
  a source.

## When the person genuinely is not findable

Some people have no profile, or a profile with no employer, or a name that
cannot be reconciled with their address. Say so plainly and move on. A contact
that keeps its placeholder name is a contact a human can fix in five seconds; a
contact with the wrong person''s job history is one nobody knows to fix.
', '---
name: identity-matching
description: How to decide that a LinkedIn profile is the person behind a CRM email address, and when to refuse.
---

# Identity matching

You are given an email address and a company. You need the person. Getting this
wrong writes a stranger''s career onto a customer''s record, so the procedure is
built to fail closed.

## Why the obvious approach does not work

`pmarchetti@fernhill.com` is not a name. Searching for it directly returns nothing.
Asking a model what it stands for produces "Paula Marchetti" — which happens to be
right, and would have been just as confident had it been wrong. You cannot tell
the difference afterwards, which is why guessing is banned outright.

What works is handing over every clue you already hold — the address itself, the
name on the record, the employer and its domain — and letting the resolver match
them against real profiles. The clues go into the **query**, and the answer comes
from the profile.

That is the shape of every match: say where to look, never what you will find.

## The procedure

0. **`read_crm_history` first.** It is free and it is often decisive. If they
   have ever replied to us from that address, you already have the strongest
   evidence available anywhere — `crm.thread-reply` — and a signature block may
   hand you their title as well. Start every match here, not at a search engine.
1. **`resolve_linkedin_profile`** when the record holds no LinkedIn URL. Pass the
   email, the company name and domain, and any first and last name the CRM has.
   It returns one candidate and a verdict. A candidate is a lead, not an answer.
2. **`get_linkedin_profile`** when the record already holds a LinkedIn URL, or to
   check a candidate at a different URL. Pass the email, company name
   and domain — **and the `contactId`**. It returns the profile, their full work
   history *and a verdict*, in one lookup. Passing the id is what lets it copy
   their photograph, which it does only if the verdict comes back positive, in
   code, without asking you. Leaving it out costs the contact their picture and
   saves nothing.

   Both calls cost the same, and they are the most expensive you have. Two or
   three lookups is the whole budget for a contact, so do not run both when one
   answers. A record with a LinkedIn URL needs step 2 only.
3. **Read the verdict, not the profile.** It checks three things:
   - `emailMatches` — the profile lists the address we are identifying.
   - `employerMatches` — a current position matches the company we have.
   - `nameMatches` — the real name is consistent with the email local part
     (`y` + `okonkwo` → Tomi Okonkwo).
4. **`emailMatches` settles it on its own.** The person put that address on their
   own profile. Nothing else you can observe is stronger.
5. **Otherwise both, or it is not them.** One of the other two is not a weaker
   match, it is a different person who happens to share something.
6. If no candidate passes, **stop**. Leaving "Pmarchetti" in the CRM is the correct
   outcome when you do not know.

Somebody whose LinkedIn URL is **already on the record** has been through all of
this before. Do not re-run it to get a picture — `fetch_contact_photo` is one
call, and the URL sitting there is the verification.

## Reporting the match

Call `identify_contact` with what you actually saw:

| What you have | Evidence to record | What happens |
| --- | --- | --- |
| `emailMatches` is true | `profile.email-match` | Written to the record. |
| Employer and name both pass | `linkedin.employer-and-name` | Written to the record. |
| They replied from that address | `crm.thread-reply` | Written to the record. |
| One check passes | `employer-only`, or the profile as `search.cites-profile` | Offered to a rep as a suggestion. |
| Sources disagree | add a `contradiction` entry | Held. Nobody is shown a guess. |

The `sourceUrl` to cite is the one the tool hands back — the profile URL the
person''s own record lists. A lookup that comes back with no source is a lookup
you cannot write a fact from.

The `One check passes` row is the case this exists for. Four Marchettis work at Fernhill; a
human settles that in three seconds, and the old rule — throw away anything
short of certain — meant we paid for that lookup every run and learned nothing
from it. A suggestion is not a failed match. It is the match, handed to the one
person who can finish it.

Do not add evidence you did not observe to push a claim over a line.

## Things that look like evidence and are not

- **A search result.** Search says where to look. A query for "Paula Marchetti"
  once returned Brightwater''s CEO, an HR lead at Reply, and a data engineer in
  Seattle — all with total confidence.
- **A matching first name.** Half the Chrises at a company are not your Chris.
  The surname or the employer has to carry it.
- **Perplexity''s view of somebody''s job title.** It aggregates stale sources; it
  said "Account Executive L3" for a profile that reads "Growth Specialist at
  Fernhill". For identity, the person''s own profile wins.
- **A very plausible expansion.** `jsmith` is probably J. Smith. Probably is not
  a source.

## When the person genuinely is not findable

Some people have no profile, or a profile with no employer, or a name that
cannot be reconciled with their address. Say so plainly and move on. A contact
that keeps its placeholder name is a contact a human can fix in five seconds; a
contact with the wrong person''s job history is one nobody knows to fix.
', now()),
('lead-qualification', 'Lead qualification', 'Load when deciding what to do with a project in Leads — whether it is worth an email, what the first touch is, and how the reply (or silence) turns into Qualify, Watch, or Archive. Recommend; John decides.', '---
description: Load when deciding what to do with a project in Leads — whether it is worth an email, what the first touch is, and how the reply (or silence) turns into Qualify, Watch, or Archive. Recommend; John decides.
---

# Lead qualification

A lead is a ConstructConnect project nobody has spoken to yet. Qualifying
means someone at the firm has confirmed it is real and a curtain conversation
is worth having. The way you find that out is by asking — John''s own rule:
"what makes me say yes is picking up the phone or sending the email."

## Worth an email

Any of these on a residential, hospitality, healthcare, office, or mixed-use
building in design (schematic through construction documents):

- Elevator lobbies on more than one floor: any building four stories and up
  with residential or hotel use.
- Atriums, open stairs, connected floors, or large open lobbies mentioned in
  the scope.
- A parking garage under occupied floors.
- Healthcare of any size.

Not worth one on its own: single-story retail, warehouses, site work,
renovations that do not touch the core, and anything already under
construction unless it is a large one where the curtain package may still be
open.

Value is a tie-breaker, not a gate. A $3M four-story R-2 in a city John
covers is a lead; a $200M distribution center is not.

## The first touch

Load `box-lunch`; the first touch on a lead *is* the project architect intro.
Use the template. The email names the building and asks for twenty minutes.
Nothing about the product.

If the firm has nobody named, read the team page first. If that yields
nothing, the office manager note is the first touch.

## Turning the reply into triage

You recommend; John clicks Qualify, Watch, or Archive on the project.

- **Qualify** when someone at the firm confirms the project is live and
  engages at all — a date, a question, a redirect to a real person. Suggest
  the stage from the ConstructConnect record.
- **Watch** when the project is real but early (pre-design or schematic with
  no design team engagement yet), or when the reply is "too early, try us in
  the spring". Suggest a re-check date from what they said, or 90 days.
- **Archive** when the project is dead, on hold indefinitely, already past
  curtain scope (under construction with the package let), or the firm says
  they do not do that work. Say why in one line so the archive is searchable.
- **Silence** after the full box-lunch rhythm (two people, three touches) is
  a Watch at 60 days, not an Archive. Buildings outlast unanswered emails.

Put the recommendation in the thread as one line — "Recommend: Qualify at
Design Development; Carey Jackson confirmed CDs in October" — and put a
to-do for John if it needs his click today.

## Record what you learned

Anything the firm says about the building that ConstructConnect did not have
(a GC, a bid month, a change of scope, a competitor already specified) goes
on the project: competitor intel via the project''s competition fields, people
via `add_project_participant`, everything else as a fact with the email as
the source.
', '---
description: Load when deciding what to do with a project in Leads — whether it is worth an email, what the first touch is, and how the reply (or silence) turns into Qualify, Watch, or Archive. Recommend; John decides.
---

# Lead qualification

A lead is a ConstructConnect project nobody has spoken to yet. Qualifying
means someone at the firm has confirmed it is real and a curtain conversation
is worth having. The way you find that out is by asking — John''s own rule:
"what makes me say yes is picking up the phone or sending the email."

## Worth an email

Any of these on a residential, hospitality, healthcare, office, or mixed-use
building in design (schematic through construction documents):

- Elevator lobbies on more than one floor: any building four stories and up
  with residential or hotel use.
- Atriums, open stairs, connected floors, or large open lobbies mentioned in
  the scope.
- A parking garage under occupied floors.
- Healthcare of any size.

Not worth one on its own: single-story retail, warehouses, site work,
renovations that do not touch the core, and anything already under
construction unless it is a large one where the curtain package may still be
open.

Value is a tie-breaker, not a gate. A $3M four-story R-2 in a city John
covers is a lead; a $200M distribution center is not.

## The first touch

Load `box-lunch`; the first touch on a lead *is* the project architect intro.
Use the template. The email names the building and asks for twenty minutes.
Nothing about the product.

If the firm has nobody named, read the team page first. If that yields
nothing, the office manager note is the first touch.

## Turning the reply into triage

You recommend; John clicks Qualify, Watch, or Archive on the project.

- **Qualify** when someone at the firm confirms the project is live and
  engages at all — a date, a question, a redirect to a real person. Suggest
  the stage from the ConstructConnect record.
- **Watch** when the project is real but early (pre-design or schematic with
  no design team engagement yet), or when the reply is "too early, try us in
  the spring". Suggest a re-check date from what they said, or 90 days.
- **Archive** when the project is dead, on hold indefinitely, already past
  curtain scope (under construction with the package let), or the firm says
  they do not do that work. Say why in one line so the archive is searchable.
- **Silence** after the full box-lunch rhythm (two people, three touches) is
  a Watch at 60 days, not an Archive. Buildings outlast unanswered emails.

Put the recommendation in the thread as one line — "Recommend: Qualify at
Design Development; Carey Jackson confirmed CDs in October" — and put a
to-do for John if it needs his click today.

## Record what you learned

Anything the firm says about the building that ConstructConnect did not have
(a GC, a bid month, a change of scope, a competitor already specified) goes
on the project: competitor intel via the project''s competition fields, people
via `add_project_participant`, everything else as a fact with the email as
the source.
', now()),
('quote-cadence', 'Quote cadence', 'Load when a quote (a deal with a bid date) reaches a checkpoint, or when John asks where a quote stands. The clock runs from the bid date. Distributor quotes are chased outward; direct bids are chased inward.', '---
description: Load when a quote (a deal with a bid date) reaches a checkpoint, or when John asks where a quote stands. The clock runs from the bid date. Distributor quotes are chased outward; direct bids are chased inward.
---

# Quote cadence

A quote is a deal hanging off a project: one buyer, one number, one bid
date. The clock starts on the **bid date**, not the day the quote went out.
Judge every reply against the calendar. "Still with the GC" is fine at day
45 and a problem at month five, even though the words are the same.

## The two tracks

**Distributor** (`channel: DISTRIBUTOR`). A distributor''s salesperson owns the
relationship with the GC. Your job is to get a read out of them, on a cadence,
without being a pest, and to train them to ask the estimator "where did we
land?" after bid day.

**Direct** (`channel: DIRECT`). Stöbich bid straight to the GC. There is no
salesperson to chase; the follow-up belongs to John. Your job is to put the
check-in on his calendar with what to ask, not to email the GC yourself.

## Checkpoints (days past bid date)

| Day | Distributor | Direct |
| --- | --- | --- |
| 0 | Nothing. Bid day. | Nothing. |
| 14 | First ask: "Where did we land? Did the estimator give you a read?" | To-do for John: call the GC estimator for a read. |
| 30 | Check-in. Ask for the GC''s status and any competitor pricing they heard. | To-do: check in with the GC. |
| 60 | Check-in. Same question, shorter. | To-do. |
| 90 | Check-in, and say plainly it has been three months. | To-do, flagged as the outer edge. |
| 180 | Stop emailing the distributor. Escalate to John: to-do to phone the GC or contractor directly. | To-do: escalate. Ask John whether the quote is dead. |

Between checkpoints, do nothing. If the distributor replied since the last
checkpoint with something coherent (a stage, a date, a number, "still
deciding"), skip the next check-in and log what they said instead. Silence is
what triggers a check-in, not the date alone.

## Before drafting

1. `read_deal_history` — what has been said, by whom, when.
2. `read_project` on the linked project — the building, the GC, the people
   John assigned, and whether the agent already drafted on this quote.
3. If the deal has a contact attached, that is who you write to. If not, use
   the most recent person at the distributor who appears in the thread. If
   there is nobody, do not guess an email: put a to-do for John naming the
   distributor and stop.
4. Load `drafting-for-john`. Then `draft_email`.

Never draft twice on the same quote inside seven days. The project read shows
the agent''s own writes; check it.

## What the check-in says

One short paragraph. Name the project and the bid date. Ask where it landed
with the GC and whether the estimator gave any read after bid day. If it is
day 30 or later, also ask whether they heard anything about competitor
pricing. One question, easy to answer in a sentence. The estimator question is
in every check-in on purpose — it is a habit you are building in the
distributor.

## What to record

- Anything the distributor says about where it landed goes on the project as
  competitor intel: `record_fact` with what they said, and rate how sure.
- A won or lost signal ("we got it", "went with X", a PO number) is not yours
  to act on. Put a to-do for John: "Mark <project> won/lost — <what they
  said>." He decides.
- Every check-in you draft and every to-do you place is already logged; do not
  add a separate note about it.

## Escalation at six months

For a distributor quote: one to-do for John, on the CRM calendar, titled
"Call the GC on <project> — 6 months, no read from <distributor>". Include
the GC''s name and number from the project read. Do not email the distributor
again.

For a direct bid: the same to-do, plus a question in the thread: is this
quote dead? If John says yes, he closes it; you never close a quote.
', '---
description: Load when a quote (a deal with a bid date) reaches a checkpoint, or when John asks where a quote stands. The clock runs from the bid date. Distributor quotes are chased outward; direct bids are chased inward.
---

# Quote cadence

A quote is a deal hanging off a project: one buyer, one number, one bid
date. The clock starts on the **bid date**, not the day the quote went out.
Judge every reply against the calendar. "Still with the GC" is fine at day
45 and a problem at month five, even though the words are the same.

## The two tracks

**Distributor** (`channel: DISTRIBUTOR`). A distributor''s salesperson owns the
relationship with the GC. Your job is to get a read out of them, on a cadence,
without being a pest, and to train them to ask the estimator "where did we
land?" after bid day.

**Direct** (`channel: DIRECT`). Stöbich bid straight to the GC. There is no
salesperson to chase; the follow-up belongs to John. Your job is to put the
check-in on his calendar with what to ask, not to email the GC yourself.

## Checkpoints (days past bid date)

| Day | Distributor | Direct |
| --- | --- | --- |
| 0 | Nothing. Bid day. | Nothing. |
| 14 | First ask: "Where did we land? Did the estimator give you a read?" | To-do for John: call the GC estimator for a read. |
| 30 | Check-in. Ask for the GC''s status and any competitor pricing they heard. | To-do: check in with the GC. |
| 60 | Check-in. Same question, shorter. | To-do. |
| 90 | Check-in, and say plainly it has been three months. | To-do, flagged as the outer edge. |
| 180 | Stop emailing the distributor. Escalate to John: to-do to phone the GC or contractor directly. | To-do: escalate. Ask John whether the quote is dead. |

Between checkpoints, do nothing. If the distributor replied since the last
checkpoint with something coherent (a stage, a date, a number, "still
deciding"), skip the next check-in and log what they said instead. Silence is
what triggers a check-in, not the date alone.

## Before drafting

1. `read_deal_history` — what has been said, by whom, when.
2. `read_project` on the linked project — the building, the GC, the people
   John assigned, and whether the agent already drafted on this quote.
3. If the deal has a contact attached, that is who you write to. If not, use
   the most recent person at the distributor who appears in the thread. If
   there is nobody, do not guess an email: put a to-do for John naming the
   distributor and stop.
4. Load `drafting-for-john`. Then `draft_email`.

Never draft twice on the same quote inside seven days. The project read shows
the agent''s own writes; check it.

## What the check-in says

One short paragraph. Name the project and the bid date. Ask where it landed
with the GC and whether the estimator gave any read after bid day. If it is
day 30 or later, also ask whether they heard anything about competitor
pricing. One question, easy to answer in a sentence. The estimator question is
in every check-in on purpose — it is a habit you are building in the
distributor.

## What to record

- Anything the distributor says about where it landed goes on the project as
  competitor intel: `record_fact` with what they said, and rate how sure.
- A won or lost signal ("we got it", "went with X", a PO number) is not yours
  to act on. Put a to-do for John: "Mark <project> won/lost — <what they
  said>." He decides.
- Every check-in you draft and every to-do you place is already logged; do not
  add a separate note about it.

## Escalation at six months

For a distributor quote: one to-do for John, on the CRM calendar, titled
"Call the GC on <project> — 6 months, no read from <distributor>". Include
the GC''s name and number from the project read. Do not email the distributor
again.

For a direct bid: the same to-do, plus a question in the thread: is this
quote dead? If John says yes, he closes it; you never close a quote.
', now()),
('reading-a-firm-website', 'Reading a firm''s website', 'Use when you need to learn who works at a company or confirm someone''s title, and the mailbox has not told you. Read the firm''s own website with read_website instead of a paid lookup.', '---
description: Use when you need to learn who works at a company or confirm someone''s title, and the mailbox has not told you. Read the firm''s own website with read_website instead of a paid lookup.
---

# Reading a firm''s website

Architecture, engineering and contracting firms publish their people. The
firm''s own site is public, current, and free to read, and for these firms it
is usually more complete than LinkedIn. Prefer it.

## When

- A contact has a name and a company but no title.
- You need the project architect for a named project and only know the firm.
- You are about to record a fact about someone''s role at a firm.
- A company record has a domain but no description, city or phone.

Do not use it to find a person''s home address, personal email, or anything
the firm did not choose to publish.

## How

1. `read_website` the homepage. Note what the firm does and where it is.
2. Look in the returned `links` for a People, Team, Staff, Leadership, About
   or Principals page. Open the best one with `read_website`. If a firm has
   several offices, prefer the page for the office on the project.
3. Read names and titles off the page. A name next to a title on a team page
   is `kind: "stated"` evidence — the firm said it. A name in a project
   caption ("Project Architect: Jane Smith") is also stated.
4. Match to the CRM with `search_crm` before creating anything. Same first and
   last name at the same company is the same person.
5. Record what you saw with `record_fact` (title, role, office) and cite the
   page URL. Do not invent emails; the import already built them from the
   firm''s pattern and a bounce will correct them.

## What not to do

- Do not paste the whole page into a fact. One fact per claim.
- Do not read more than three pages of one site in a session; if the team
  page is not obvious, stop and ask.
- Do not treat a headshot caption as a title if the title is missing.
', '---
description: Use when you need to learn who works at a company or confirm someone''s title, and the mailbox has not told you. Read the firm''s own website with read_website instead of a paid lookup.
---

# Reading a firm''s website

Architecture, engineering and contracting firms publish their people. The
firm''s own site is public, current, and free to read, and for these firms it
is usually more complete than LinkedIn. Prefer it.

## When

- A contact has a name and a company but no title.
- You need the project architect for a named project and only know the firm.
- You are about to record a fact about someone''s role at a firm.
- A company record has a domain but no description, city or phone.

Do not use it to find a person''s home address, personal email, or anything
the firm did not choose to publish.

## How

1. `read_website` the homepage. Note what the firm does and where it is.
2. Look in the returned `links` for a People, Team, Staff, Leadership, About
   or Principals page. Open the best one with `read_website`. If a firm has
   several offices, prefer the page for the office on the project.
3. Read names and titles off the page. A name next to a title on a team page
   is `kind: "stated"` evidence — the firm said it. A name in a project
   caption ("Project Architect: Jane Smith") is also stated.
4. Match to the CRM with `search_crm` before creating anything. Same first and
   last name at the same company is the same person.
5. Record what you saw with `record_fact` (title, role, office) and cite the
   page URL. Do not invent emails; the import already built them from the
   firm''s pattern and a bounce will correct them.

## What not to do

- Do not paste the whole page into a fact. One fact per claim.
- Do not read more than three pages of one site in a session; if the team
  page is not obvious, stop and ask.
- Do not treat a headshot caption as a title if the title is missing.
', now()),
('writing-a-brief', 'Writing a brief', 'Use when writing the Background panel on a contact — the shape, the tone, and when to write nothing at all.', '---
description: Use when writing the Background panel on a contact — the shape, the tone, and when to write nothing at all.
---

# Writing a brief

The Background panel is the first thing on a contact''s record and the last thing
a rep reads before a call. Two or three sentences, then the structured lines.

## The shape, and it does not vary

> Lewis Carhart is the CEO and co-founder of Comp AI. He previously led growth
> at Fleetio and spent four years at Deloitte in risk advisory.

Current role first, then what they did before. Third person, present tense,
their name at the front. Only what a source states — a job you cannot see on a
profile did not happen, and a date range you are unsure of is left out rather
than approximated.

## Nothing about the person

No "seasoned", no "passionate about", no "well-regarded", no guessing at how
senior or how influential they are. If you find yourself writing an adjective
about somebody rather than a fact about their work, delete the sentence.

The tell: could a rep repeat this sentence to the person on a call without
embarrassment? "You''ve been at Comp AI two years" is fine. "You''re a seasoned
security leader" is not.

## The structured lines

`sections` are scanned, not read. Fill only what you know:

- `currentRole` — `"CEO & Co-founder · Comp AI"`
- `tenure` — `"2 yrs 3 mos"`, from the profile''s own dates
- `previousRoles` — one string per role, most recent first
- `seniority` — `"Founder / C-level"`, `"VP"`, `"IC"`
- `function` — `"Executive"`, `"Security"`, `"Finance"`
- `location` — city and country, as the profile writes it

An empty line is better than a guessed one. The panel renders what it has.

## When to write nothing

If the only thing you can say is the job title already on the record, write
nothing. An empty panel costs a rep nothing; a paragraph that restates a field
they can already see costs them the time it takes to find that out.

The tool enforces a floor on length for the same reason: at forty characters
there is no room to say nothing at length.
', '---
description: Use when writing the Background panel on a contact — the shape, the tone, and when to write nothing at all.
---

# Writing a brief

The Background panel is the first thing on a contact''s record and the last thing
a rep reads before a call. Two or three sentences, then the structured lines.

## The shape, and it does not vary

> Lewis Carhart is the CEO and co-founder of Comp AI. He previously led growth
> at Fleetio and spent four years at Deloitte in risk advisory.

Current role first, then what they did before. Third person, present tense,
their name at the front. Only what a source states — a job you cannot see on a
profile did not happen, and a date range you are unsure of is left out rather
than approximated.

## Nothing about the person

No "seasoned", no "passionate about", no "well-regarded", no guessing at how
senior or how influential they are. If you find yourself writing an adjective
about somebody rather than a fact about their work, delete the sentence.

The tell: could a rep repeat this sentence to the person on a call without
embarrassment? "You''ve been at Comp AI two years" is fine. "You''re a seasoned
security leader" is not.

## The structured lines

`sections` are scanned, not read. Fill only what you know:

- `currentRole` — `"CEO & Co-founder · Comp AI"`
- `tenure` — `"2 yrs 3 mos"`, from the profile''s own dates
- `previousRoles` — one string per role, most recent first
- `seniority` — `"Founder / C-level"`, `"VP"`, `"IC"`
- `function` — `"Executive"`, `"Security"`, `"Finance"`
- `location` — city and country, as the profile writes it

An empty line is better than a guessed one. The panel renders what it has.

## When to write nothing

If the only thing you can say is the job title already on the record, write
nothing. An empty panel costs a rep nothing; a paragraph that restates a field
they can already see costs them the time it takes to find that out.

The tool enforces a floor on length for the same reason: at forty characters
there is no room to say nothing at length.
', now());
