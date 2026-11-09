import { GuideRoute } from "@/components/site/guide-route";

export default function ExplorePage({ params }: { params: Promise<{ lang: string }> }) {
  return <GuideRoute params={params} kind="explore" />;
}
