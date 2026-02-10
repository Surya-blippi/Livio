'use client';

import { useState } from 'react';

// Inline Icons to avoid dependencies
const LoaderIcon = () => (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const ShareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
        <polyline points="16 6 12 2 8 6"></polyline>
        <line x1="12" y1="2" x2="12" y2="15"></line>
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

interface SocialBonusCardProps {
    userId: string;
    initialStatus?: 'idle' | 'pending' | 'approved' | 'rejected' | null;
}

export default function SocialBonusCard({ userId, initialStatus = 'idle' }: SocialBonusCardProps) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected' | null>(initialStatus);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(
        initialStatus === 'rejected'
            ? { type: 'error', text: "Your previous claim was rejected. Please try again with a valid post." }
            : null
    );

    const handleSubmit = async () => {
        if (!url) return;
        setMessage(null);

        // Basic client validation
        if (!url.toLowerCase().includes('linkedin.com') && !url.toLowerCase().includes('twitter.com') && !url.toLowerCase().includes('x.com')) {
            setMessage({ type: 'error', text: "Please provide a valid LinkedIn or Twitter/X post URL." });
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/credits/claim-bonus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, postUrl: url })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 409) {
                    setStatus('pending');
                    setMessage({ type: 'success', text: "You have already submitted a claim. It is under review or approved." });
                    return;
                }
                throw new Error(data.error || 'Failed to submit');
            }

            setStatus('pending');
            setMessage({ type: 'success', text: "Thank you for submission, verification in progress - the turnaround time of approval is 12 hours or earlier." });
            setUrl('');

        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: "Failed to submit claim. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    if (status === 'approved') {
        return (
            <div className="bg-[var(--surface-2)] border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_#000]">
                <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-lg mb-1">
                    <CheckIcon />
                    Bonus Unlocked!
                </div>
                <div className="text-[var(--text-secondary)] text-sm">
                    You earned 500 credits for sharing.
                </div>
            </div>
        );
    }

    return (
        <div className="border-2 border-black bg-[var(--surface-1)] rounded-xl p-5 shadow-[4px_4px_0px_#000]">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-lg mb-2">
                <ShareIcon />
                Get 500 Free Credits
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4">
                Post about <strong>Pocket Influencer</strong> on LinkedIn or Twitter/X to earn credits.
            </p>

            <div className="space-y-4">
                <div className="text-sm text-[var(--text-secondary)] space-y-1">
                    <p>1. Write a post sharing your experience.</p>
                    <p>2. Paste the link to your post below.</p>
                </div>

                {message && (
                    <div className={`text-xs p-2 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                {status === 'pending' ? (
                    <div className="p-3 bg-[var(--surface-2)] text-[var(--text-primary)] rounded-md border-2 border-black text-sm flex items-center gap-2">
                        <LoaderIcon />
                        Verification in progress...
                    </div>
                ) : (
                    <input
                        type="text"
                        placeholder="https://linkedin.com/posts/..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border-2 border-[var(--border-subtle)] focus:outline-none focus:border-black bg-white text-sm"
                    />
                )}
            </div>

            {status !== 'pending' && (
                <button
                    onClick={handleSubmit}
                    disabled={loading || !url}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 bg-[var(--brand-primary)] text-black border-2 border-black rounded-lg font-bold transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                    {loading && <LoaderIcon />}
                    Claim 500 Credits
                </button>
            )}
        </div>
    );
}
