---
description: Load when a quote (a deal with a bid date) reaches a checkpoint, or when John asks where a quote stands. The clock runs from the bid date. Distributor quotes are chased outward; direct bids are chased inward.
---

# Quote cadence

A quote is a deal hanging off a project: one buyer, one number, one bid
date. The clock starts on the **bid date**, not the day the quote went out.
Judge every reply against the calendar. "Still with the GC" is fine at day
45 and a problem at month five, even though the words are the same.

## The two tracks

**Distributor** (`channel: DISTRIBUTOR`). A distributor's salesperson owns the
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
| 30 | Check-in. Ask for the GC's status and any competitor pricing they heard. | To-do: check in with the GC. |
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
the agent's own writes; check it.

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
the GC's name and number from the project read. Do not email the distributor
again.

For a direct bid: the same to-do, plus a question in the thread: is this
quote dead? If John says yes, he closes it; you never close a quote.
