export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(iso),
  );

export const daysSince = (iso: string, asOf = new Date()) =>
  Math.floor(
    (asOf.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24),
  );

export const bandColor = (band: "green" | "yellow" | "red") =>
  band === "green"
    ? "bg-emerald-100 text-emerald-700"
    : band === "yellow"
      ? "bg-amber-100 text-amber-700"
      : "bg-rose-100 text-rose-700";

export const bandHex = (band: "green" | "yellow" | "red") =>
  band === "green" ? "#10b981" : band === "yellow" ? "#f59e0b" : "#ef4444";

export const sentimentColor = (
  label?: "very_negative" | "negative" | "neutral" | "positive" | "very_positive",
) => {
  switch (label) {
    case "very_negative":
    case "negative":
      return "bg-rose-100 text-rose-700";
    case "very_positive":
    case "positive":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

const FLAG_LABELS: Record<string, string> = {
  "budget-overrun": "Budget overrun",
  "behind-on-promises": "Delivery behind plan",
  "negative-call-sentiment": "Calls trending negative",
  "negative-email-sentiment": "Email tone negative",
  "no-recent-contact": "No recent contact",
  "declining-momentum": "Momentum declining",
  "escalation-risk": "Escalation risk",
  "churn-risk": "Churn risk",
};

export const formatFlag = (flag: string): string =>
  FLAG_LABELS[flag] ??
  flag
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
