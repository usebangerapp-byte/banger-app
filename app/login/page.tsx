"use client";

export default function LoginPage() {
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
  return null;
}
