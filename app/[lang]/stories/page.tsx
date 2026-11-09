import { GuideRoute } from "@/components/site/guide-route";

export default function StoriesPage({ params }: { params: Promise<{ lang: string }> }) {
  return <GuideRoute params={params} kind="stories" />;
}
