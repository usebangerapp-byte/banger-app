"use client";
import { useEffect, useRef, useState } from "react";
export default function ShowMoreToggle({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current?.closest("details") as HTMLDetailsElement | null;
    if (!el) return;
    const h = () => setOpen(el.open);
    el.addEventListener("toggle", h);
    return () => el.removeEventListener("toggle", h);
  }, []);
  return <span ref={ref}>{open ? "Show less ▲" : `Show more (${count}) ▼`}</span>;
}
