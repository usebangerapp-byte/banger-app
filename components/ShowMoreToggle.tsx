"use client";
import { useEffect, useRef, useState } from "react";
export default function ShowMoreToggle({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current?.closest("details") as HTMLDetailsElement | null;
    if (!el) return;
    const handler = () => setOpen(el.open);
    el.addEventListener("toggle", handler);
    return () => el.removeEventListener("toggle", handler);
  }, []);
  return (
    <span ref={ref} style={{ fontSize: 12, fontWeight: 700, opacity: 0.65, letterSpacing: "0.08em", cursor: "pointer" }}>
      {open ? "Show less" : `Show more (${count})`}
    </span>
  );
}
