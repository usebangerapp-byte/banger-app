import type { Metadata } from "next";

// Private links never reveal the track in the preview
export const metadata: Metadata = {
  title: "Private track · BANGER",
  robots: { index: false, follow: false },
  openGraph: { title: "A private track for you", description: "Sent privately on BANGER.", images: ["/api/og?k=private&t=A%20private%20track%20for%20you"] },
  twitter: { card: "summary_large_image", images: ["/api/og?k=private&t=A%20private%20track%20for%20you"] },
};

export default function ListenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
