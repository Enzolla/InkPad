"use client";

import dynamic from "next/dynamic";
import { DialogProvider } from "@/components/Dialog";
import { LoadingScreen } from "@/components/LoadingScreen";

const InkPadApp = dynamic(() => import("@/components/InkPadApp"), {
  ssr: false,
  loading: () => <LoadingScreen message="Abrindo o InkPad…" />,
});

export default function Home() {
  return (
    <DialogProvider>
      <InkPadApp />
    </DialogProvider>
  );
}
