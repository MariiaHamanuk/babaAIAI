import { getPortfolio } from "@/lib/data/getPortfolio";
import PortfolioClient from "./PortfolioClient";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const initial = await getPortfolio();
  return <PortfolioClient initial={initial} />;
}
