---
description: Use when you need to learn who works at a company or confirm someone's title, and the mailbox has not told you. Read the firm's own website with read_website instead of a paid lookup.
---

# Reading a firm's website

Architecture, engineering and contracting firms publish their people. The
firm's own site is public, current, and free to read, and for these firms it
is usually more complete than LinkedIn. Prefer it.

## When

- A contact has a name and a company but no title.
- You need the project architect for a named project and only know the firm.
- You are about to record a fact about someone's role at a firm.
- A company record has a domain but no description, city or phone.

Do not use it to find a person's home address, personal email, or anything
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
   firm's pattern and a bounce will correct them.

## What not to do

- Do not paste the whole page into a fact. One fact per claim.
- Do not read more than three pages of one site in a session; if the team
  page is not obvious, stop and ask.
- Do not treat a headshot caption as a title if the title is missing.
