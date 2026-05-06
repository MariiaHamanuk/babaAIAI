import { bandColor } from "@/lib/format";

export function HealthBadge({
  score,
  band,
  size = "md",
}: {
  score: number;
  band: "green" | "yellow" | "red";
  size?: "sm" | "md" | "lg";
}) {
  const px = size === "lg" ? "text-3xl" : size === "sm" ? "text-xs" : "text-base";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold ${bandColor(band)} ${px}`}
    >
      {score}
    </span>
  );
}
