// Scam and risk scanner for strategy posts. Pure functions, no imports, so it runs in Next.js,
// in the API route and under `node --test` identically. Rules always run; the AI layer (see
// /api/risk) can only raise a verdict, never lower it.

export interface RiskInput {
  title: string;
  summary: string;
  steps: string[];
  risks: string;
  risk: "low" | "medium" | "high";
  capitalNeededNear: number;
}

export type Verdict = "ok" | "review" | "block";

export interface Finding {
  id: string;
  weight: number;
  critical: boolean;
  message: string;
  excerpt: string;
}

export interface RiskResult {
  score: number; // 0-100
  verdict: Verdict;
  findings: Finding[];
}

interface Rule {
  id: string;
  weight: number;
  critical?: boolean;
  message: string;
  test: (text: string) => string | null; // returns matching excerpt or null
}

const re = (pattern: RegExp) => (text: string) => text.match(pattern)?.[0] ?? null;

const NEGATION = /\b(never|don'?t|do not|not|won'?t|no one should|nobody should)\b[^.!?\n]{0,30}$/i;

/** Seed phrase / private key mentioned as something to hand over, not as a warning. */
function secretRequest(text: string): string | null {
  const secret = /(seed phrase|secret recovery phrase|recovery phrase|private key|secret key)/gi;
  let m: RegExpExecArray | null;
  while ((m = secret.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 60), m.index);
    const around = text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
    const asksToShare = /(send|share|enter|give|paste|type|provide|submit|dm|import|verify|validate)\b/i.test(around);
    if (asksToShare && !NEGATION.test(before)) return around.trim();
  }
  return null;
}

/** Yield claims that no honest strategy can promise. */
function absurdYield(text: string): string | null {
  const pct = /(\d{1,5}(?:\.\d+)?)\s*%\s*(?:(?:return|profit|gain|yield|apy|roi)s?\s*)?(daily|per day|a day|every day|weekly|per week|a week|monthly|per month|a month)/gi;
  let m: RegExpExecArray | null;
  while ((m = pct.exec(text))) {
    const value = parseFloat(m[1]);
    const period = m[2].toLowerCase();
    const limit = /dai|day/.test(period) ? 2 : /week/.test(period) ? 10 : 50;
    if (value > limit) return m[0];
  }
  const multiple = text.match(/\b(\d{2,}|[5-9])\s?x\b(?!\s?(?:faster|more\s+secure))/i);
  return multiple?.[0] ?? null;
}

const RULES: Rule[] = [
  {
    id: "secret-request",
    weight: 70,
    critical: true,
    message: "Asks for a seed phrase or private key. No legitimate strategy ever needs these.",
    test: secretRequest,
  },
  {
    id: "send-funds-first",
    weight: 60,
    critical: true,
    message: "Asks learners to send funds to the sharer or a personal address outside the escrow.",
    test: re(/(send|transfer|deposit)\s+(me|us|to my|to this|funds to (my|this))[^.!?\n]{0,40}(wallet|address|account|first)/i),
  },
  {
    id: "guaranteed-returns",
    weight: 40,
    message: "Promises guaranteed or risk-free returns. Returns are never guaranteed.",
    test: re(/\b(guarantee[ds]?|risk[- ]free|can'?t lose|cannot lose|no risk|zero risk|sure profit|100% safe)\b/i),
  },
  {
    id: "absurd-yield",
    weight: 40,
    message: "Claims a yield or multiple far beyond what is realistic.",
    test: absurdYield,
  },
  {
    id: "recruitment",
    weight: 45,
    message: "Rewards bringing in other people, a pyramid or referral-scheme pattern.",
    test: re(/\b(downline|multi-?level|pyramid|ponzi|recruit(ing)?\b|bring (in )?(your )?(friends|others|people)|earn (from|when) (your )?(referrals|invites))/i),
  },
  {
    id: "wallet-drainer",
    weight: 35,
    message: "Asks for unlimited approvals or connecting a wallet to an unknown site.",
    test: re(/(approve (all|unlimited)|setApprovalForAll|unlimited (approval|allowance)|connect (your )?wallet to (this|the|my) (site|link|website|dapp))/i),
  },
  {
    id: "pump-language",
    weight: 25,
    message: "Pump language or presale hype.",
    test: re(/\b(moon(ing)?|pump(ing)?|guaranteed gem|presale|next (bitcoin|solana|near)|1000x|100x)\b/i),
  },
  {
    id: "referral-links",
    weight: 20,
    message: "Contains referral or affiliate links. Declare them or remove them.",
    test: re(/([?&](ref|referral|invite|aff|affiliate)=[^\s&]+|use my (link|code)|invite code|affiliate)/i),
  },
  {
    id: "urgency",
    weight: 15,
    message: "Pressure and urgency wording.",
    test: re(/\b(act now|limited (spots|slots|time)|last chance|only \d+ (spots|slots) left|hurry|before it'?s too late|don'?t miss out)\b/i),
  },
  {
    id: "off-platform",
    weight: 15,
    message: "Moves the conversation off the platform.",
    test: re(/\b(dm me|message me on|contact me (on|at)|whatsapp|telegram me|join my (telegram|discord|group))\b/i),
  },
];

const STRUCTURE_WEIGHT = 15;

export function scanPost(post: RiskInput): RiskResult {
  const text = [post.title, post.summary, ...post.steps, post.risks].join("\n");
  const findings: Finding[] = [];

  for (const rule of RULES) {
    const excerpt = rule.test(text);
    if (excerpt) {
      findings.push({
        id: rule.id,
        weight: rule.weight,
        critical: !!rule.critical,
        message: rule.message,
        excerpt: excerpt.slice(0, 120),
      });
    }
  }

  if (post.risks.trim().length < 30) {
    findings.push({
      id: "thin-risk-section",
      weight: STRUCTURE_WEIGHT,
      critical: false,
      message: "The downside section is missing or too short to be useful.",
      excerpt: post.risks.trim().slice(0, 120),
    });
  }
  if (post.steps.filter((s) => s.trim()).length < 2) {
    findings.push({
      id: "too-few-steps",
      weight: 10,
      critical: false,
      message: "Fewer than two concrete steps. A learner cannot follow this.",
      excerpt: "",
    });
  }
  if (post.risk === "low" && post.capitalNeededNear > 0 && /\b(leverage|margin|futures|perp|memecoin|presale)\b/i.test(text)) {
    findings.push({
      id: "risk-label-mismatch",
      weight: 20,
      critical: false,
      message: 'Labelled "low risk" but describes leveraged or speculative instruments.',
      excerpt: "",
    });
  }

  const score = Math.min(100, findings.reduce((sum, f) => sum + f.weight, 0));
  return { score, verdict: verdictFor(score, findings), findings };
}

export function verdictFor(score: number, findings: Finding[]): Verdict {
  if (findings.some((f) => f.critical) || score >= 60) return "block";
  if (score >= 25) return "review";
  return "ok";
}

const ORDER: Record<Verdict, number> = { ok: 0, review: 1, block: 2 };

/** The stricter of two verdicts. Used to merge rules with the AI review: AI can only raise. */
export function stricter(a: Verdict, b: Verdict): Verdict {
  return ORDER[a] >= ORDER[b] ? a : b;
}
