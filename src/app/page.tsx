"use client";

import dynamic from "next/dynamic";
import { DialogProvider } from "@/components/Dialog";

const InkPadApp = dynamic(() => import("@/components/InkPadApp"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <div className="h-2 w-2 rounded-full bg-primary anim-pulse" />
    </div>
  ),
});

export default function Home() {
  return (
    <DialogProvider>
      <InkPadApp />
    </DialogProvider>
  );
}
