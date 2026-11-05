import { redirect } from "next/navigation";

export default async function EditFeedItemPage({
  params,
}: {
  params: Promise<{ feedId: string }>;
}): Promise<never> {
  const { feedId } = await params;
  redirect(`/security-feed/${encodeURIComponent(feedId)}`);
}
