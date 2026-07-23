"use client";

import dynamic from "next/dynamic";

const InkPadApp = dynamic(() => import("@/components/InkPadApp"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20" />
    </div>
  ),
});

export default function Home() {
  return <InkPadApp />;
}
