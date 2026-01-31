'use client';

import { useState, useEffect } from 'react';

// Inline Icons
const LoaderIcon = () => (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const RejectIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

// ... existing icons ...

export default function AdminClaimsPage() {
    // ... existing state ...

    // ... existing fetch ...

    const handleReject = async (id: string) => {
        setProcessingId(id);
        try {
            const res = await fetch('/api/admin/claims/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ claimId: id })
            });
            if (res.ok) {
                setClaims(prev => prev.filter(c => c.id !== id));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setProcessingId(null);
        }
    };

    // ... handleApprove ...

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* ... header ... */}
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Social Claims Review</h1>
                    <div className="text-sm text-gray-500">
                        {claims.length} pending
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <div className="text-indigo-600"><LoaderIcon /></div>
                    </div>
                ) : claims.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
                        <p className="text-gray-500">No pending claims found.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {claims.map(claim => (
                            <div key={claim.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1 overflow-hidden">
                                    <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded">
                                            {claim.user_id.substring(0, 8)}...
                                        </span>
                                        <span>•</span>
                                        <span>{formatDate(claim.created_at)}</span>
                                    </div>
                                    <a
                                        href={claim.post_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium truncate"
                                    >
                                        <span className="truncate">{claim.post_url}</span>
                                        <ExternalLinkIcon />
                                    </a>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleReject(claim.id)}
                                        disabled={!!processingId}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed text-red-700 rounded-lg font-medium transition-colors text-sm min-w-[100px]"
                                    >
                                        {processingId === claim.id ? <LoaderIcon /> : <RejectIcon />}
                                        <span>Reject</span>
                                    </button>
                                    <button
                                        onClick={() => handleApprove(claim.id)}
                                        disabled={!!processingId}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm min-w-[120px]"
                                    >
                                        {processingId === claim.id ? <LoaderIcon /> : <CheckIcon />}
                                        <span>Approve</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
