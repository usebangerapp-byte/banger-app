"use client";
import React from "react";
type SkeletonProps = { width?: number|string; height?: number|string; radius?: number; variant?: "rect"|"circle"; size?: number; style?: React.CSSProperties };
export function Skeleton({ width="100%", height=16, radius=8, variant, size, style }: SkeletonProps) {
  const isCircle = variant === "circle";
  return <div style={{ width: isCircle?size:width, height: isCircle?size:height, borderRadius: isCircle?"50%":radius, background: "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease-in-out infinite", flexShrink: 0, ...style }} />;
}
export function SkeletonTrackRow() {
  return <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
    <Skeleton variant="circle" size={40} />
    <div style={{ flex:1, display:"grid", gap:6 }}><Skeleton width="65%" height={14} /><Skeleton width="40%" height={12} /></div>
    <Skeleton width={32} height={14} radius={999} />
  </div>;
}
export function SkeletonStyles() {
  return <style>{`@keyframes skeleton-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>;
}
