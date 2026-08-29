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
  // Headings use `italic` (hero h1, card/dialog titles). Without this the
  // browser synthesises the slant and Chakra Petch loses its squared-off
  // letterforms.
  style:    ["normal", "italic"],
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
  // The next/font variables must sit on <html>, not <body>. Tailwind v4
  // compiles the @theme block to :root, so --font-sans and --font-headline are
  // declared there; a custom property substitutes its var() references where it
  // is declared, so with the font variables on <body> those references resolve
  // against :root, find nothing, and leave both tokens guaranteed-invalid.
  // Every element then falls back to the system stack.
  return (
    <html lang="en" className={`${inter.variable} ${chakraPetch.variable}`}>
      <body className="bg-dark-darker text-light font-sans antialiased">
        <NativeLinkHandler />
        {children}
      </body>
    </html>
  );
}
