import { ClientCard } from "./ClientCard";
import type { Client } from "@/lib/types";

export function ClientGrid({ clients }: { clients: Client[] }) {
  const sorted = [...clients].sort((a, b) => a.health.score - b.health.score);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((c) => (
        <ClientCard key={c.id} client={c} />
      ))}
    </div>
  );
}
