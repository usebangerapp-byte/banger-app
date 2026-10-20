"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Stops any preview / audio still playing when the user moves to another page. */
export default function RouteAudioStop() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try {
      const w = window as any;
      const shared = w._bangerAudio as HTMLAudioElement | undefined;
      if (shared && !shared.paused) { shared.pause(); shared.currentTime = 0; }
      w._bangerAudioTrackId = null;
      document.querySelectorAll("audio").forEach((a) => { try { a.pause(); } catch {} });
    } catch {}
  }, [pathname]);

  return null;
}
