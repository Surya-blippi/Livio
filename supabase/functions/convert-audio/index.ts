// Supabase Edge Function: convert-audio
// Converts WebM audio to MP3 using FFmpeg WASM
// Deploy this to Supabase Edge Functions

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// FFmpeg WASM for Deno
import { FFmpeg } from "https://esm.sh/@ffmpeg/ffmpeg@0.12.7";
import { fetchFile, toBlobURL } from "https://esm.sh/@ffmpeg/util@0.12.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log("Starting audio conversion...");

        // Get Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get the audio file from request
        const formData = await req.formData();
        const audioFile = formData.get("audio") as File;
        const userId = formData.get("userId") as string;

        if (!audioFile) {
            return new Response(
                JSON.stringify({ error: "Audio file is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Received file: ${audioFile.name}, size: ${audioFile.size}, type: ${audioFile.type}`);

        // Initialize FFmpeg
        const ffmpeg = new FFmpeg();

        // Load FFmpeg WASM
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd";
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });

        console.log("FFmpeg loaded successfully");

        // Write input file to FFmpeg virtual filesystem
        const inputFileName = "input.webm";
        const outputFileName = "output.mp3";

        const audioBuffer = await audioFile.arrayBuffer();
        await ffmpeg.writeFile(inputFileName, new Uint8Array(audioBuffer));

        console.log("Converting to MP3...");

        // Convert to MP3
        await ffmpeg.exec([
            "-i", inputFileName,
            "-vn",                    // No video
            "-acodec", "libmp3lame",  // MP3 codec
            "-ab", "128k",            // Bitrate
            "-ar", "44100",           // Sample rate
            outputFileName
        ]);

        // Read the converted file
        const outputData = await ffmpeg.readFile(outputFileName);
        const mp3Buffer = outputData as Uint8Array;

        console.log(`Conversion complete, output size: ${mp3Buffer.length}`);

        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `voice_${userId || "anonymous"}_${timestamp}.mp3`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("voice-samples")
            .upload(fileName, mp3Buffer, {
                contentType: "audio/mpeg",
                upsert: true,
            });

        if (uploadError) {
            console.error("Upload error:", uploadError);
            throw new Error(`Failed to upload: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from("voice-samples")
            .getPublicUrl(fileName);

        console.log("Upload successful:", urlData.publicUrl);

        return new Response(
            JSON.stringify({
                success: true,
                url: urlData.publicUrl,
                fileName: fileName,
                originalSize: audioFile.size,
                convertedSize: mp3Buffer.length,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );

    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({
                error: error.message || "Conversion failed",
                details: String(error)
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
