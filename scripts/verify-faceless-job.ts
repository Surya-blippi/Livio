
// Removed import, using native fetch
// If node version < 18, this might fail, but let's try.

async function testFacelessVideo() {
    const payload = {
        scenes: [
            {
                text: "This is just a test to understand what is working. If this works the eureka if not tai tai fiss.",
                assetUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
            }
        ],
        voiceId: "11labs-voice-id",
        aspectRatio: "9:16",
        captionStyle: "bold-classic",
        enableBackgroundMusic: false,
        enableCaptions: true,
        userId: "test-user-verify"
    };

    try {
        console.log('🚀 Sending faceless video job request...');
        const response = await fetch('http://localhost:3000/api/faceless-video/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Job started successfully:', data);
        } else {
            console.error('❌ Job failed:', response.status, data);
        }
    } catch (error) {
        console.error('❌ Connection error:', error);
        console.log('Make sure the Next.js server is running on localhost:3000');
    }
}

testFacelessVideo();
