import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import { InAppBrowserCheck } from "@/components/InAppBrowserCheck";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Reven - Pocket Creator",
    description: "Transform your photo into an AI-powered talking head video",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <ClerkProvider>
            <html lang="en">
                <body className={inter.className}>
                    <InAppBrowserCheck>
                        {children}
                    </InAppBrowserCheck>
                </body>
            </html>
        </ClerkProvider>
    );
}
