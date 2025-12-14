import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UGC AI - Générez des vidéos UGC illimitées avec l'IA",
  description: "Créez des vidéos UGC authentiques en quelques minutes avec l'IA. Acteurs virtuels réalistes, scripts optimisés conversion, 10x moins cher que les créateurs traditionnels. Essai gratuit.",
  keywords: "UGC, vidéo IA, marketing vidéo, TikTok ads, créateur UGC, intelligence artificielle, publicité vidéo",
  openGraph: {
    title: "UGC AI - Générez des vidéos UGC illimitées avec l'IA",
    description: "Créez des vidéos UGC authentiques en quelques minutes. 10x moins cher, 100x plus rapide.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "UGC AI - Vidéos UGC générées par IA",
    description: "Créez des vidéos UGC authentiques en quelques minutes. Essai gratuit.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
