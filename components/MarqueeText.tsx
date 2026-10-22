"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent } from "react";

/**
 * One-line text. Tap → it glides to reveal the rest, pauses, glides back and loops.
 * Tapping another MarqueeText anywhere in the app stops this one (only one moves at a time).
 */
const EVT = "banger-marquee-active";

/** `group`: lines sharing a group move together (e.g. a track's title and its artist line). */
export default function MarqueeText({ text, style, group }: { text: string; style?: CSSProperties; group?: string }) {
  const id = useId();
  const boxRef = useRef<HTMLSpanElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const [active, setActive] = useState(false);
  const [dist, setDist] = useState(0);

  useEffect(() => {
    const onOther = (e: Event) => {
      const d = (e as CustomEvent).detail as { id: string; group?: string; on: boolean };
      if (d.id === id) return;
      if (group && d.group === group) setActive(d.on);   // my partner line was tapped: follow it
      else if (d.on) setActive(false);                   // something else started moving: stop
    };
    window.addEventListener(EVT, onOther);
    return () => window.removeEventListener(EVT, onOther);
  }, [id, group]);

  useEffect(() => {
    if (!active) { setDist(0); return; }
    const box = boxRef.current, inner = innerRef.current;
    if (box && inner) setDist(Math.max(0, inner.scrollWidth - box.clientWidth));
  }, [active, text]);

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    const next = !active;
    setActive(next);
    window.dispatchEvent(new CustomEvent(EVT, { detail: { id, group, on: next } }));
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
