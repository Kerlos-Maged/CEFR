import { GuideRoute } from "@/components/site/guide-route";

export default function CollectionsPage({ params }: { params: Promise<{ lang: string }> }) {
  return <GuideRoute params={params} kind="collections" />;
}
