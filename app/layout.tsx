import type { Metadata, Viewport } from "next";
import { Inter, Chakra_Petch } from "next/font/google";
import NativeLinkHandler from "@/components/NativeLinkHandler";
import "./globals.css";

const inter = Inter({
  subsets:  ["latin"],
  variable: "--font-inter",
});

const chakraPetch = Chakra_Petch({
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700"],
  variable: "--font-chakra-petch",
});

const SITE_URL = "https://www.startlineau.com";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default:  "Startline - Find Your Next Race",
    template: "%s | Startline",
  },
  description:
    "Discover fitness racing, CrossFit, running and hybrid fitness events across Australia. Find, compare and register for competitions near you.",
  keywords: [
    "fitness events Australia",
    "fitness racing Australia",
    "CrossFit competition",
    "running races",
    "hybrid fitness",
    "obstacle course",
    "fitness competition NSW VIC QLD",
  ],

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type:        "website",
    siteName:    "Startline",
    title:       "Startline - Find Your Next Race",
    description:
      "Discover fitness racing, CrossFit, running and hybrid fitness events across Australia.",
    url:         SITE_URL,
    images: [
      {
        url:    "/site-preview.png",
        width:  1200,
        height: 630,
        alt:    "Startline - Australia's fitness event calendar",
      },
    ],
  },

  twitter: {
    card:        "summary_large_image",
    title:       "Startline - Find Your Next Race",
    description: "Discover fitness racing, CrossFit, running and hybrid fitness events across Australia.",
    images:      ["/site-preview.png"],
  },

  icons: {
    icon: [
      { url: "/images/logo.svg",                           type: "image/svg+xml" },
      { url: "/images/favicon_io/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/images/favicon_io/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon_io/favicon.ico" },
    ],
    shortcut: "/images/logo.svg",
    apple:    "/images/favicon_io/apple-touch-icon.png",
  },

  robots: {
    index:            true,
    follow:           true,
    googleBot: {
      index:               true,
      follow:              true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet":       -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${chakraPetch.variable} bg-dark-darker text-light font-sans antialiased`}
      >
        <NativeLinkHandler />
        {children}
      </body>
    </html>
  );
}
