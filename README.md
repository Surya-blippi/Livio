# Reven - Pocket Creator - AI Talking Head Video Generator

Create stunning AI-powered talking head videos with your photo, custom scripts, and voice cloning!

## Features

✨ **AI Script Generation** - Gemini AI creates engaging 10-second scripts on any topic  
🎤 **Voice Cloning** - MiniMax clones your voice from just 10 seconds of audio  
🗣️ **Natural Text-to-Speech** - Your cloned voice narrates the script  
📹 **Talking Head Videos** - WaveSpeed InfiniteTalk brings your photo to life  
🎨 **Stunning UI** - Glassmorphism design with smooth animations  
🔐 **Authentication** - Secure Google sign-in with Clerk  

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Authentication**: Clerk (Google OAuth)
- **AI APIs**:
  - Gemini AI (Script Generation)
  - FAL.ai MiniMax (Voice Cloning & TTS)
  - WaveSpeed InfiniteTalk (Video Creation)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- API Keys for:
  - Google Gemini AI
  - FAL.ai (for MiniMax)
  - WaveSpeed InfiniteTalk
  - Clerk (for authentication)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Pocket-Influencer
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Create a `.env.local` file in the root directory:

```env
# Gemini API Key
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key

# FAL.ai API Key (for MiniMax Voice Cloning)
FAL_KEY=your_fal_api_key

# WaveSpeed API Key
NEXT_PUBLIC_WAVESPEED_API_KEY=your_wavespeed_api_key

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Sign In**: Click the user button in the top-right to sign in with Google
2. **Upload Photo**: Drag and drop your photo or click to select
3. **Choose Topic**: Enter a topic for your video script
4. **Review Script**: Edit the AI-generated script if needed
5. **Record Voice**: Record 10+ seconds of your voice (or upload an audio file)
6. **Generate Video**: Wait while AI creates your talking head video
7. **Download & Share**: Download your video or share on social media

## Features in Detail

### Voice Cloning Optimization
- First recording clones your voice and saves it locally
- Subsequent videos reuse your voice for faster generation
- Click "Create New" to clear saved voice and re-clone

### Script Generation
- Powered by Gemini AI with streaming support
- Optimized for 10-second videos
- Fully editable inline

### Video Creation
- High-quality 720p output
- Realistic lip-sync with WaveSpeed InfiniteTalk
- Auto-polling for completion status

## Project Structure

```
Pocket-Influencer/
├── app/
│   ├── api/                 # API routes
│   │   ├── generate-script/ # Gemini script generation
│   │   ├── clone-voice/     # FAL MiniMax voice cloning
│   │   ├── generate-speech/ # Text-to-speech with cloned voice
│   │   └── create-video/    # WaveSpeed video creation
│   ├── layout.tsx           # Root layout with Clerk provider
│   ├── page.tsx             # Main application
│   └── globals.css          # Global styles
├── components/              # React components
├── lib/                     # Utilities
├── middleware.ts            # Clerk authentication middleware
└── public/                  # Static assets
```

## Authentication

The app uses Clerk for authentication with Google OAuth:
- Users must sign in to access the app
- Sign-in/sign-out via UserButton in top-right corner
- Session management handled automatically
- API routes remain public for internal use

## Troubleshooting

### Voice Cloning Issues
- Ensure audio is at least 10 seconds long
- Use clear audio with minimal background noise
- Check FAL.ai API quota and credentials

### Video Not Showing
- Video generation can take 2-5 minutes
- Check WaveSpeed dashboard for processing status
- Ensure all API credentials are correct

### Build Errors
- Run `npm install` to ensure all dependencies are installed
- Clear `.next` folder and rebuild: `rm -rf .next && npm run dev`

## License

MIT

## Support

For issues or questions, please open an issue on the repository.
