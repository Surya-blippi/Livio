import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Adjust import if needed

export async function POST(req: NextRequest) {
    console.log("🔔 [Webhook] JSON2Video callback received");
    try {
        const body = await req.json();
        const { id, url, project, success, status: statusMsg } = body;

        // JSON2Video sends 'id' (which is our movie ID? or we use project?)
        // The user docs say: "The id property is populated with the value of the id property of the movie"
        // If we didn't send an ID, we might need to match by Project ID.
        // Let's assume we match by 'project' which is the Project ID.

        // However, we need to map Project ID back to our Job ID.
        // We stored project ID in `input_data.pendingRender.projectId` inside `video_jobs` table.
        // But querying JSONB is slow/complex if not indexed.
        // Ideally we should have sent OUR Job ID as the movie ID.

        const projectId = project;
        const videoUrl = url;

        if (!projectId || !videoUrl) {
            console.warn("⚠️ [Webhook] Missing project ID or URL", body);
            return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
        }

        console.log(`✅ [Webhook] Render Done! Project: ${projectId}, URL: ${videoUrl}`);

        // Find the job that has this project ID pending
        // Since we don't have a direct index, we might need to rely on the fact that we can search or we should have passed the Job ID.
        // Let's assume for now we search or maybe we passed Job ID as 'id' in the payload?
        // IF we update the submitter to pass 'id: jobId', then `id` in body will be jobId.

        // Let's check if 'id' looks like a UUID (our job ID).
        const possibleJobId = id;

        let job;
        if (possibleJobId && possibleJobId.length > 10) {
            const { data } = await supabase.from('video_jobs').select('*').eq('id', possibleJobId).single();
            job = data;
        }

        if (!job) {
            // Fallback: This is risky without index, but maybe okay for low volume.
            // OR we just rely on polling fallback for now if we can't match?
            console.error("❌ [Webhook] Could not match Job ID");
            return NextResponse.json({ message: "Job not found" }, { status: 404 });
        }

        // Job Found. Update it.
        const inputData = job.input_data || {};

        // Update job status
        await supabase.from('video_jobs').update({
            status: 'completed',
            progress: 100,
            progress_message: 'Video ready! (Webhook)',
            result_data: { videoUrl: videoUrl, duration: body.duration || 0 },
            input_data: { ...inputData, pendingRender: null }, // Clear pending
            is_processing: false,
            updated_at: new Date().toISOString()
        }).eq('id', job.id);

        // Insert into videos table (Persistence)
        await supabase.from('videos').insert({
            user_id: job.user_id,
            video_url: videoUrl,
            script: job.script,
            mode: job.mode,
            topic: job.topic,
            duration: body.duration !== undefined ? Math.round(Number(body.duration)) : 0,
            has_captions: inputData.enableCaptions,
            has_music: inputData.enableBackgroundMusic,
            assets: inputData.scenes?.map((s: any) => ({ url: s.visual, text: s.text })) || [],
            thumbnail_url: null
        });

        return NextResponse.json({ received: true });

    } catch (e) {
        console.error("💥 [Webhook] Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
