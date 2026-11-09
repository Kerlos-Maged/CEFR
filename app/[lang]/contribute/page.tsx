import { GuideRoute } from "@/components/site/guide-route";

export default function ContributePage({ params }: { params: Promise<{ lang: string }> }) {
  return <GuideRoute params={params} kind="contribute" />;
}
