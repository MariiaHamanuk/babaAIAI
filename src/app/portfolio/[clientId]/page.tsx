import ClientDetailClient from "./ClientDetailClient";

type Props = { params: Promise<{ clientId: string }> };

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: Props) {
  const { clientId } = await params;
  return <ClientDetailClient clientId={clientId} />;
}
