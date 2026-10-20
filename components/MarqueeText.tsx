"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent } from "react";

/**
 * One-line text. Tap → it glides to reveal the rest, pauses, glides back and loops.
 * Tapping another MarqueeText anywhere in the app stops this one (only one moves at a time).
 */
const EVT = "banger-marquee-active";

export default function MarqueeText({ text, style }: { text: string; style?: CSSProperties }) {
  const id = useId();
  const boxRef = useRef<HTMLSpanElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const [active, setActive] = useState(false);
  const [dist, setDist] = useState(0);

  useEffect(() => {
    const onOther = (e: Event) => { if ((e as CustomEvent).detail !== id) setActive(false); };
    window.addEventListener(EVT, onOther);
    return () => window.removeEventListener(EVT, onOther);
  }, [id]);

  useEffect(() => {
    if (!active) { setDist(0); return; }
    const box = boxRef.current, inner = innerRef.current;
    if (box && inner) setDist(Math.max(0, inner.scrollWidth - box.clientWidth));
  }, [active, text]);

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    const next = !active;
    setActive(next);
    if (next) window.dispatchEvent(new CustomEvent(EVT, { detail: id }));
  }

  const moving = active && dist > 0;
  const duration = Math.max(4, dist / 28 + 2.5);
  const mask = "linear-gradient(90deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%)";

  return (
    <span ref={boxRef} onClick={toggle} title={text}
      style={{
        display: "block", overflow: "hidden", whiteSpace: "nowrap", cursor: "pointer", minWidth: 0,
        maskImage: moving ? mask : undefined, WebkitMaskImage: moving ? mask : undefined,
        ...style,
        textOverflow: undefined,
      }}>
      <span ref={innerRef} style={{
        display: moving ? "inline-block" : "block",
        overflow: moving ? "visible" : "hidden", textOverflow: moving ? "clip" : "ellipsis", whiteSpace: "nowrap",
        ["--marquee-dist" as any]: `-${dist}px`,
        animation: moving ? `banger-marquee ${duration}s ease-in-out infinite` : "none",
      }}>{text}</span>
    </span>
  );
}
