import { supabaseAdmin } from './supabase-admin';
import { v4 as uuidv4 } from 'uuid';

export interface IngestResult {
    assetId: string;
    publicUrl: string;
    error?: string;
}

/**
 * Downloads a file from a remote URL and uploads it to Supabase Storage.
 * Then creates a record in the 'assets' table.
 */
export async function ingestAsset(
    remoteUrl: string,
    userId: string,
    sourceName: string = 'external'
): Promise<IngestResult> {
    try {
        console.log(`[Ingest] Starting ingest for ${remoteUrl}`);

        // 1. Download the image
        const response = await fetch(remoteUrl);
        if (!response.ok) throw new Error(`Failed to fetch remote image: ${response.statusText}`);

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Determine mime type and extension
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        let ext = 'jpg';
        if (contentType.includes('png')) ext = 'png';
        if (contentType.includes('webp')) ext = 'webp';
        if (contentType.includes('gif')) ext = 'gif';

        // 2. Upload to Supabase Storage (Using Admin Client to bypass RLS for upload if needed, or ensuring bucket exists)
        // Make sure 'assets' bucket exists in Supabase!
        const fileName = `${userId}/${uuidv4()}.${ext}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('assets') // Ensure this bucket exists!
            .upload(fileName, buffer, {
                contentType: contentType,
                upsert: true
            });

        if (uploadError) {
            console.error('[Ingest] Storage upload error:', uploadError);
            throw uploadError;
        }

        // 3. Get Public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('assets')
            .getPublicUrl(fileName);

        // 4. Save to 'assets' Table
        // We use supabaseAdmin here because this might run in a background job
        const { data: assetRecord, error: dbError } = await supabaseAdmin
            .from('assets')
            .insert({
                user_id: userId,
                type: 'image', // simplified for now
                storage_path: fileName,
                public_url: publicUrl,
                source_url: remoteUrl,
                source_name: sourceName,
                metadata: { original_size: buffer.length }
            })
            .select()
            .single();

        if (dbError) {
            console.error('[Ingest] DB Insert error:', dbError);
            throw dbError;
        }

        console.log(`[Ingest] Success! Asset ID: ${assetRecord.id}`);

        return {
            assetId: assetRecord.id,
            publicUrl: publicUrl
        };

    } catch (error) {
        console.error('[Ingest] Failed:', error);
        return {
            assetId: '',
            publicUrl: remoteUrl, // Fallback to original if ingest fails? Or error out?
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
