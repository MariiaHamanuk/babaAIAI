/**
 * Single source of truth for v0.0 mock data.
 * Each scenario projects into Jira/HubSpot mock shapes via the integrations layer.
 *
 * Dates anchor to a fixed "today" so the demo is reproducible across re-runs.
 */

export const TODAY = new Date("2026-05-06T12:00:00Z");

const daysAgo = (n: number) =>
  new Date(TODAY.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const daysFromNow = (n: number) =>
  new Date(TODAY.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

export type Scenario = {
  id: string;
  name: string;
  domain: string;
  industry: string;
  ownerEmail: string;
  deal: {
    amount: number;
    stage:
      | "Qualified"
      | "Negotiation"
      | "Contract Sent"
      | "Closed Won"
      | "Closed Lost";
    startedDaysAgo: number;
  };
  project: {
    jiraKey: string;
    budgetedHours: number;
    burnRate: number; // 1.0 = on track; 1.3 = 30% over
    completionRate: number; // 0..1, fraction of expected progress actually delivered
    timelineStartDaysAgo: number;
    timelineDueDaysFromNow: number;
    committedPoints: number;
  };
  cadence: {
    callsTotal: number;
    emailsTotal: number;
    lastContactDaysAgo: number;
  };
  // Vivid texts make sentiment classification reliable. 2-3 sentences each.
  calls: Array<{ daysAgo: number; participants: string[]; notes: string }>;
  emails: Array<{ daysAgo: number; subject: string; snippet: string }>;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "northwind",
    name: "Northwind Logistics",
    domain: "northwind.test",
    industry: "Logistics",
    ownerEmail: "anna@studio.test",
    deal: {
      amount: 120_000,
      stage: "Closed Won",
      startedDaysAgo: 95,
    },
    project: {
      // Pattern: Best case — Delivered > Time > Budget. At ~50% time:
      // Time 50%, Budget ~35%, Delivered ~65%.
      jiraKey: "NW",
      budgetedHours: 800,
      burnRate: 0.7,
      completionRate: 1.3,
      timelineStartDaysAgo: 45,
      timelineDueDaysFromNow: 45,
      committedPoints: 90,
    },
    cadence: { callsTotal: 5, emailsTotal: 18, lastContactDaysAgo: 3 },
    calls: [
      {
        daysAgo: 3,
        participants: ["anna@studio.test", "ceo@northwind.test"],
        notes:
          "Excellent progress review. The CEO confirmed they want to expand to two more warehouses next quarter and mentioned they'll be a reference. Asked about a roadmap for advanced reporting.",
      },
      {
        daysAgo: 14,
        participants: ["anna@studio.test", "ops@northwind.test"],
        notes:
          "Walkthrough of new dashboard went smoothly. Ops lead said the team adopted it on day one and metrics already moved in the right direction.",
      },
      {
        daysAgo: 30,
        participants: ["anna@studio.test", "cto@northwind.test"],
        notes:
          "Architecture review. CTO appreciative of the clean handover docs. No concerns raised; minor suggestion on logging format which we agreed to.",
      },
    ],
    emails: [
      {
        daysAgo: 2,
        subject: "Re: Q3 expansion",
        snippet:
          "Thanks again for the demo — we're definitely moving forward with the second region. Can you send a proposed timeline?",
      },
      {
        daysAgo: 9,
        subject: "Quick win",
        snippet:
          "Wanted to flag that we hit 18% reduction in routing errors this week. Team is thrilled.",
      },
    ],
  },

  {
    id: "pinecone",
    name: "Pinecone Retail",
    domain: "pinecone.test",
    industry: "Retail",
    ownerEmail: "marko@studio.test",
    deal: {
      amount: 80_000,
      stage: "Contract Sent",
      startedDaysAgo: 70,
    },
    project: {
      // Pattern: Worst case — Budget ≫ Time > Delivered. At ~70% time:
      // Time 70%, Budget ~105%, Delivered ~40%.
      jiraKey: "PC",
      budgetedHours: 600,
      burnRate: 1.5,
      completionRate: 0.57,
      timelineStartDaysAgo: 63,
      timelineDueDaysFromNow: 27,
      committedPoints: 80,
    },
    cadence: { callsTotal: 4, emailsTotal: 22, lastContactDaysAgo: 5 },
    calls: [
      {
        daysAgo: 5,
        participants: ["marko@studio.test", "pm@pinecone.test"],
        notes:
          "Tense call. PM pushed back hard on the timeline slip and asked why we are well over budget but have only delivered roughly half the promised features. Asked for a written recovery plan by end of week.",
      },
      {
        daysAgo: 12,
        participants: ["marko@studio.test", "pm@pinecone.test"],
        notes:
          "Status update. Acknowledged we're tracking behind on the recommendations engine. PM repeatedly asked whether we'll need a budget increase. We deferred answering until next week.",
      },
      {
        daysAgo: 28,
        participants: ["marko@studio.test", "cto@pinecone.test"],
        notes:
          "Scope review. CTO questioned whether the original estimate was realistic. Some discussion about deferring the analytics module to phase two.",
      },
    ],
    emails: [
      {
        daysAgo: 3,
        subject: "Recovery plan",
        snippet:
          "We need a clear written commitment by Friday on what will and will not ship. The current trajectory is not acceptable to our exec team.",
      },
      {
        daysAgo: 11,
        subject: "Re: Sprint review",
        snippet:
          "Concerned about the velocity drop over the last two sprints. What's driving it?",
      },
    ],
  },

  {
    id: "acme",
    name: "Acme Foods",
    domain: "acme.test",
    industry: "Food & Beverage",
    ownerEmail: "lena@studio.test",
    deal: {
      amount: 45_000,
      stage: "Negotiation",
      startedDaysAgo: 110,
    },
    project: {
      // Pattern: Stalled — Time alone, Budget and Delivered both very low.
      // At ~70% time: Time 70%, Budget ~25%, Delivered ~20%.
      jiraKey: "AF",
      budgetedHours: 300,
      burnRate: 0.36,
      completionRate: 0.29,
      timelineStartDaysAgo: 84,
      timelineDueDaysFromNow: 36,
      committedPoints: 40,
    },
    cadence: { callsTotal: 2, emailsTotal: 6, lastContactDaysAgo: 36 },
    calls: [
      {
        daysAgo: 36,
        participants: ["lena@studio.test", "vp@acme.test"],
        notes:
          "Last contact. VP said internal priorities shifted and they'd circle back in a few weeks. Polite but vague. We sent two follow-ups since with no reply.",
      },
      {
        daysAgo: 75,
        participants: ["lena@studio.test", "manager@acme.test"],
        notes:
          "Kickoff. Project framing was clear at the time and the team was engaged.",
      },
    ],
    emails: [
      {
        daysAgo: 21,
        subject: "Checking in",
        snippet:
          "Wanted to follow up on our March conversation — let me know a good time to reconnect.",
      },
      {
        daysAgo: 14,
        subject: "Re: Checking in",
        snippet: "(no reply received)",
      },
    ],
  },

  {
    id: "helio",
    name: "Helio Bank",
    domain: "heliobank.test",
    industry: "Financial Services",
    ownerEmail: "yura@studio.test",
    deal: {
      amount: 200_000,
      stage: "Closed Won",
      startedDaysAgo: 130,
    },
    project: {
      // Pattern: Productivity problem — Time > Budget > Delivered.
      // At ~65% time: Time 65%, Budget ~60%, Delivered ~35%.
      jiraKey: "HB",
      budgetedHours: 1200,
      burnRate: 0.92,
      completionRate: 0.54,
      timelineStartDaysAgo: 104,
      timelineDueDaysFromNow: 56,
      committedPoints: 140,
    },
    cadence: { callsTotal: 6, emailsTotal: 30, lastContactDaysAgo: 4 },
    calls: [
      {
        daysAgo: 4,
        participants: ["yura@studio.test", "sponsor@heliobank.test"],
        notes:
          "Sponsor was visibly frustrated about the slip on the compliance module. Threatened to escalate to their CIO if we miss the next deadline. Asked for a daily status until further notice.",
      },
      {
        daysAgo: 18,
        participants: ["yura@studio.test", "sponsor@heliobank.test"],
        notes:
          "Productive but cool. Discussed scope concerns around the audit log feature. Sponsor said the timeline is starting to feel risky.",
      },
      {
        daysAgo: 35,
        participants: ["yura@studio.test", "cto@heliobank.test"],
        notes:
          "Solid technical review. CTO satisfied with the architecture. Light tone, no concerns raised.",
      },
    ],
    emails: [
      {
        daysAgo: 2,
        subject: "Daily status please",
        snippet:
          "As discussed, we expect a daily update until the compliance module is back on track. This is non-negotiable.",
      },
      {
        daysAgo: 16,
        subject: "Concerned about timeline",
        snippet:
          "I'm concerned the audit log feature is going to slip. Can you confirm the current ETA and what risks you see?",
      },
    ],
  },

  {
    id: "onyx",
    name: "Onyx Studios",
    domain: "onyx.test",
    industry: "Media",
    ownerEmail: "ira@studio.test",
    deal: {
      amount: 30_000,
      stage: "Qualified",
      startedDaysAgo: 14,
    },
    project: {
      // Pattern: Done early, premium — Delivered > Budget > Time.
      // At ~50% time: Time 50%, Budget ~65%, Delivered ~80%.
      jiraKey: "OS",
      budgetedHours: 160,
      burnRate: 1.3,
      completionRate: 1.6,
      timelineStartDaysAgo: 30,
      timelineDueDaysFromNow: 30,
      committedPoints: 20,
    },
    cadence: { callsTotal: 2, emailsTotal: 3, lastContactDaysAgo: 2 },
    calls: [
      {
        daysAgo: 2,
        participants: ["ira@studio.test", "founder@onyx.test"],
        notes:
          "Founder thrilled with how fast we're shipping — first major feature went live a full sprint ahead of plan. Mentioned the pace is letting them lock in their launch event sooner. No concerns raised.",
      },
      {
        daysAgo: 18,
        participants: ["ira@studio.test", "founder@onyx.test"],
        notes:
          "Mid-project check-in. Team is sprinting hard to hit the early launch window. Hours are running a bit higher than the original plan but the founder confirmed they're happy to trade hours for speed.",
      },
    ],
    emails: [
      {
        daysAgo: 1,
        subject: "Re: ahead of plan",
        snippet:
          "Genuinely impressed with the velocity — let's talk about a phase two scope after launch.",
      },
    ],
  },
];

// Helpers used by integration mocks
export const seedHelpers = { TODAY, daysAgo, daysFromNow };
