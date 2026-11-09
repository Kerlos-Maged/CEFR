import { GuideRoute } from "@/components/site/guide-route";

export default function ResearchPage({ params }: { params: Promise<{ lang: string }> }) {
  return <GuideRoute params={params} kind="research" />;
}
