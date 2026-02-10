"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/lib/toast";

export function InAppBrowserCheck({ children }: { children: React.ReactNode }) {
    const [isInAppBrowser, setIsInAppBrowser] = useState(false);
    const [currentUrl, setCurrentUrl] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined") {
            setCurrentUrl(window.location.href);
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

            // Detection for common in-app browsers
            const isLinkedIn = /LinkedInApp/i.test(userAgent);
            const isFacebook = /FBAV|FBAN/i.test(userAgent);
            const isInstagram = /Instagram/i.test(userAgent);

            // Generic check for other common in-app browsers if needed
            // const isGenericWebView = /wv|Android.*Version\/[0-9].*Chrome\/[0-9]/i.test(userAgent) || ((/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(userAgent)));

            if (isLinkedIn || isFacebook || isInstagram) {
                setIsInAppBrowser(true);
            }
        }
    }, []);

    const copyCurrentUrl = async (message: string) => {
        try {
            await navigator.clipboard.writeText(currentUrl);
            showToast({ type: 'success', message });
        } catch {
            showToast({ type: 'error', message: 'Unable to copy link. Please copy it manually.' });
        }
    };

    if (!mounted) {
        // Return null or partial content to avoid hydration mismatch if possible, 
        // but returning children is safer for SEO and initial paint.
        // However, since we might block, returning children is fine as the effect will run quickly.
        return <>{children}</>;
    }

    if (isInAppBrowser) {
        return (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white p-6 text-center font-sans">
                <div className="max-w-md w-full animate-in fade-in zoom-in duration-300">
                    <div className="mb-6 mx-auto w-20 h-20 bg-[var(--brand-primary)] border-2 border-black rounded-xl flex items-center justify-center shadow-[4px_4px_0px_#000]">
                        <span className="text-4xl">⚠️</span>
                    </div>

                    <h1 className="text-3xl font-black mb-4">Open in System Browser</h1>

                    <p className="text-lg font-bold text-gray-600 mb-8 leading-relaxed">
                        Google Sign-In is restricted inside this app.
                        <br /><br />
                        Please tap the <span className="inline-block bg-black text-white px-2 py-0.5 rounded mx-1">●●●</span> menu and select
                        <span className="inline-block bg-[var(--brand-primary)] text-black px-2 py-0.5 rounded mx-1 font-bold border border-black">Open in Browser</span>
                        or copy the link below.
                    </p>

                    <div className="bg-gray-50 border-2 border-black rounded-xl p-4 mb-6 relative group cursor-pointer"
                        onClick={() => copyCurrentUrl('Link copied. Open it in Chrome or Safari.')}>
                        <p className="font-mono text-sm break-all text-left text-gray-500 line-clamp-2">
                            {currentUrl}
                        </p>
                        <div className="absolute top-2 right-2 text-xs font-bold bg-white border border-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            Click to Copy
                        </div>
                    </div>

                    <button
                        onClick={() => copyCurrentUrl('Link copied. Open Chrome or Safari and paste it.')}
                        className="w-full py-4 bg-[var(--brand-primary)] border-2 border-black rounded-xl text-xl font-black uppercase tracking-wide shadow-[4px_4px_0px_#000] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000] transition-all active:translate-y-[4px] active:shadow-none"
                    >
                        Copy Link
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
