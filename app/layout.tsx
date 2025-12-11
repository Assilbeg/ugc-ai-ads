import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UGC AI",
  description: "Générateur de publicités UGC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Le layout réel vit dans app/[locale]/layout.tsx
  return children;
}
