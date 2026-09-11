-- CreateTable
CREATE TABLE "emailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emailTemplate_archivedAt_name_idx" ON "emailTemplate"("archivedAt", "name");

-- Seed the three drafts the agent writes most, in John's shape
INSERT INTO "emailTemplate" ("id", "name", "description", "subject", "body", "updatedAt") VALUES
('tpl_project_architect_intro', 'Project architect — box lunch intro', 'First email to the project architect on a project you found in ConstructConnect.', '{{project}} — quick intro', 'Hi {{firstName}},

I know you don''t know me from Adam, so I''ll keep this short. I''m John McPhail with Stöbich, and I came across {{project}}{{#city}} in {{city}}{{/city}}.

Mid-rise residential is where smoke and fire curtains show up in the code conversation sooner than most folks expect, and it''s a lot cheaper to know your options now than after CDs are locked. I''ve done a few hundred of these lunch talks with architects over the years, and twenty minutes usually covers it.

I''d like to bring lunch to your office and walk your team through it. If box lunches aren''t your call, would you point me to whoever''s is?

John McPhail', now()),
('tpl_office_manager', 'Office manager — who books lunches?', 'When outreach to the architect stalled; short note to the door-opener.', 'AIA box lunch at {{firm}}', 'Hi {{firstName}},

I''m John McPhail with Stöbich. I do AIA lunch presentations on smoke and fire curtain code, and I''m not sure who at {{firm}} handles scheduling those. Would you point me the right way?

Appreciate it,
John McPhail', now()),
('tpl_distributor_checkin', 'Distributor — where did we land?', 'Check-in on a quote at a cadence checkpoint. Always asks the estimator question.', '{{project}} — where did we land?', 'Hi {{firstName}},

Quick one on {{project}}{{#bidDate}} (bid {{bidDate}}){{/bidDate}}. Where did it land with the GC? If the estimator gave you any read after bid day, even a rough one, I''d love to hear it.

Thanks,
John McPhail', now());
