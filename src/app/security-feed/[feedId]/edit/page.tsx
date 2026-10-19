"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { FeedEditor } from "../../feed-editor";

function EditFeedItemContent() {
  const params = useParams();
  const feedId = String(Array.isArray(params.feedId) ? params.feedId[0] : params.feedId ?? "");

  return <FeedEditor mode="edit" feedId={feedId} />;
}

export default function EditFeedItemPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-[var(--page-bg)]" />}>
      <EditFeedItemContent />
    </Suspense>
  );
}
