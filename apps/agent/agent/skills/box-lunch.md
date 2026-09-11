---
description: Load when working a project toward an AIA box lunch — who to write to, in what order, on what rhythm, and when to hand the scheduling to the office manager. Uses John's templates.
---

# Box lunch

The goal is a lunch presentation in the architect's office, in front of the
people who will detail this building. Everything else is a step toward that.

## Who, in order

1. **The project architect** on this project, about this project. If John
   assigned someone on the project, that is the person. If not, the firm's
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
  attendees arrive in the CRM with a dated meeting. Then this skill's job on
  the project is done and `quote-cadence` takes over when a quote appears.

## What a good answer looks like

The best outcome of the first email is not a booked lunch; it is a named
person saying "talk to X about that". Treat a redirect as progress: record
X, thank the sender in one line, write to X.

## What not to do

- Do not pitch the product in the intro. The intro sells twenty minutes.
- Do not attach anything.
- Do not email a firm John presented at in the last six months without
  checking the company's meetings first (`read_company_history`); if he was
  just there, the ask is different: "here's a project of yours I noticed", not
  "may I come present".
- Do not schedule anything on John's calendar without a yes from the firm.
