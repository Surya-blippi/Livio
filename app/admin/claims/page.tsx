'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ExternalLink, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Claim {
    id: string;
    user_id: string;
    post_url: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}

export default function AdminClaimsPage() {
    const [claims, setClaims] = useState<Claim[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const supabase = createClientComponentClient();

    useEffect(() => {
        fetchClaims();
    }, []);

    const fetchClaims = async () => {
        setLoading(true);
        // We use supabase client to fetch "pending" claims.
        // Assuming RLS allows admin (service role) or we authenticated as a user with enough rights
        // If this fails due to RLS, we'd need an API route. 
        // Admin page usually implies we have special access. 
        // For "Hidden" page, usually the user visiting IS the owner/admin.
        // If RLS blocks this, we must fetch via our new admin API route or use a GET route.
        // Let's try direct DB first, if it fails, I'll update.
        // Actually, RLS policy "Users can view their own claims" BLOCKS this.
        // So we strictly need a server-side fetch or an Admin API GET route.
        // But since this is a protected admin page, let's just make it Server Component?
        // Ah, this is "use client".
        // Fast path: Just create a GET route or use Server Actions.
        // Let's create a GET endpoint in `app/api/admin/claims/approve/route.ts`? 
        // Or better, `app/api/admin/claims/route.ts` that lists them.
        // For simplicity in this turn, I will assume I can fetch OR I'll add the GET handler to `approve` route file contextually?
        // Let's just create a new API route `app/api/admin/claims/route.ts` for listing.

        try {
            const res = await fetch('/api/admin/claims');
            if (res.ok) {
                const data = await res.json();
                setClaims(data.claims);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: string) => {
        setProcessingId(id);
        try {
            const res = await fetch('/api/admin/claims/approve', {
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

    // Quick Hack: Just inline the GET route creation in task plan if I missed it, 
    // but I'll add `app/api/admin/claims/route.ts` now via write_to_file tool.

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Social Claims Review</h1>
            {loading ? (
                <div>Loading...</div>
            ) : claims.length === 0 ? (
                <div className="text-slate-500">No pending claims.</div>
            ) : (
                <div className="space-y-4">
                    {claims.map(claim => (
                        <Card key={claim.id}>
                            <CardContent className="flex items-center justify-between p-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs text-slate-400">{claim.user_id.substring(0, 8)}</span>
                                        <span className="text-sm text-slate-500">{formatDistanceToNow(new Date(claim.created_at))} ago</span>
                                    </div>
                                    <a
                                        href={claim.post_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                                    >
                                        {claim.post_url} <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => handleApprove(claim.id)}
                                        disabled={!!processingId}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        {processingId === claim.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        Approve
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
