'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

// Example prompts focused on personal branding
const EXAMPLE_PROMPTS = [
    { text: 'Share my thoughts on **leadership lessons** I learned building my startup', hasAttachments: false },
    { text: 'Create a video about **why consistency beats talent** for my LinkedIn audience', hasAttachments: false },
    { text: 'Turn this thread into a **personal brand video** with my AI avatar', hasAttachments: false },
    { text: 'Share my take on **the future of remote work** as a thought leader', hasAttachments: false },
];

// Typing animation hook
function useTypingAnimation(texts: typeof EXAMPLE_PROMPTS, typingSpeed = 35, pauseTime = 2500) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [displayText, setDisplayText] = useState('');
    const [isTyping, setIsTyping] = useState(true);

    useEffect(() => {
        const currentPrompt = texts[currentIndex].text;

        if (isTyping) {
            if (displayText.length < currentPrompt.length) {
                const timeout = setTimeout(() => {
                    setDisplayText(currentPrompt.slice(0, displayText.length + 1));
                }, typingSpeed);
                return () => clearTimeout(timeout);
            } else {
                const timeout = setTimeout(() => {
                    setIsTyping(false);
                    setDisplayText('');
                    setCurrentIndex((prev) => (prev + 1) % texts.length);
                }, pauseTime);
                return () => clearTimeout(timeout);
            }
        } else {
            setIsTyping(true);
        }
    }, [displayText, isTyping, currentIndex, texts, typingSpeed, pauseTime]);

    return { displayText, currentPrompt: texts[currentIndex], currentIndex };
}

export default function LandingPage() {
    const [inputText, setInputText] = useState('');
    const { displayText, currentPrompt, currentIndex } = useTypingAnimation(EXAMPLE_PROMPTS);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Parse text with formatting
    const parseText = (text: string) => {
        const parts = text.split(/(\*\*[^*]+\*\*|@\w+\.\w+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <span key={i} className="font-black bg-[var(--brand-primary)] text-black px-1 mx-0.5 rounded-sm">{part.slice(2, -2)}</span>;
            }
            return part;
        });
    };

    return (
        <div className="min-h-screen bg-[var(--surface-1)] text-[var(--text-primary)] font-sans">

            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 border-b-2 border-[var(--border-strong)] bg-[var(--surface-1)]/90 backdrop-blur-md">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--brand-primary)] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <span className="text-black font-black text-xl">R</span>
                        </div>
                        <span className="text-xl font-black tracking-tight">Reven - Pocket Creator</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="font-bold hover:text-[var(--text-secondary)] transition-colors">Features</a>
                        <a href="#how-it-works" className="font-bold hover:text-[var(--text-secondary)] transition-colors">How It Works</a>
                    </div>

                    <div className="flex items-center gap-4">
                        <SignedOut>
                            <SignUpButton mode="modal">
                                <button className="btn-primary">
                                    Get Started
                                </button>
                            </SignUpButton>
                        </SignedOut>
                        <SignedIn>
                            <Link href="/dashboard">
                                <button className="btn-primary">
                                    Dashboard
                                </button>
                            </Link>
                            <UserButton afterSignOutUrl="/" />
                        </SignedIn>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6 relative overflow-hidden">
                <div className="max-w-5xl mx-auto text-center relative z-10">
                    {/* Main Headline */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <h1 className="heading-hero mb-6">
                            Become the authority <br />
                            <span className="relative inline-block">
                                <span className="relative z-10">in your niche</span>
                                <span className="absolute bottom-2 left-0 right-0 h-4 bg-[var(--brand-primary)] -z-0 rotate-1"></span>
                            </span>
                        </h1>
                        <p className="text-xl md:text-2xl font-bold text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
                            Create professional videos with <span className="text-black bg-[var(--brand-primary)] px-1">your face and voice</span> — without ever picking up a camera.
                        </p>
                    </motion.div>

                    {/* Value Props */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="flex flex-wrap justify-center gap-4 mb-12"
                    >
                        {[
                            { icon: '🚫', text: 'No filming' },
                            { icon: '✂️', text: 'No editing' },
                            { icon: '⚡', text: 'Ready in minutes' },
                        ].map((item) => (
                            <span
                                key={item.text}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-black bg-white font-bold shadow-[4px_4px_0px_#000]"
                            >
                                <span>{item.icon}</span>
                                {item.text}
                            </span>
                        ))}
                    </motion.div>

                    {/* Input Box Demo */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="max-w-3xl mx-auto"
                    >
                        <div className="bg-white border-2 border-black rounded-[var(--radius-xl)] shadow-[12px_12px_0px_#000] overflow-hidden text-left relative transform transition-transform hover:-translate-y-1 hover:shadow-[16px_16px_0px_#000]">
                            {/* Fake Toolbar */}
                            <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-dashed border-gray-200 bg-gray-50">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-400 border border-black" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-400 border border-black" />
                                    <div className="w-3 h-3 rounded-full bg-green-400 border border-black" />
                                </div>
                                <div className="ml-auto flex gap-2">
                                    <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded-sm">AI EDITOR</span>
                                </div>
                            </div>

                            {/* Input Area */}
                            <div className="p-8 min-h-[200px] flex flex-col justify-center cursor-text"
                                onClick={() => {
                                    setInputText(' ');
                                    setTimeout(() => {
                                        setInputText('');
                                        inputRef.current?.focus();
                                    }, 0);
                                }}
                            >
                                {inputText ? (
                                    <textarea
                                        ref={inputRef}
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        placeholder="What's your message to the world?"
                                        className="w-full h-full text-2xl font-bold bg-transparent border-none resize-none focus:ring-0 placeholder-gray-300 outline-none leading-relaxed"
                                        autoFocus
                                    />
                                ) : (
                                    <div className="text-2xl font-bold leading-relaxed">
                                        {parseText(displayText)}
                                        <span className="inline-block w-[3px] h-8 ml-1 align-middle animate-pulse bg-black" />
                                    </div>
                                )}
                            </div>

                            {/* Bottom Action Bar */}
                            <div className="px-6 py-4 bg-[var(--surface-2)] border-t-2 border-black flex items-center justify-between">
                                <div className="flex items-center gap-4 text-sm font-bold text-[var(--text-secondary)]">
                                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" /> Voice Ready</span>
                                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" /> Avatar Ready</span>
                                </div>

                                <SignedOut>
                                    <SignUpButton mode="modal">
                                        <button className="btn-primary py-2 px-6 text-sm">
                                            Generate Video →
                                        </button>
                                    </SignUpButton>
                                </SignedOut>
                                <SignedIn>
                                    <Link href="/dashboard">
                                        <button className="btn-primary py-2 px-6 text-sm">
                                            Generate Video →
                                        </button>
                                    </Link>
                                </SignedIn>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Pain Point Section */}
            <section className="py-24 px-6 bg-[var(--surface-2)] border-y-2 border-black">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="heading-section mb-6">
                            You know you should be creating content...
                        </h2>
                        <p className="text-xl font-medium text-[var(--text-secondary)]">
                            But let's face it, the traditional way is <span className="line-through decoration-4 decoration-[var(--brand-primary)]">exhausting</span>.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { icon: '😓', title: 'Camera Shy?', desc: 'Self-conscious about lighting, angles, or how you look.' },
                            { icon: '⏰', title: 'No Time?', desc: "Hours spent editing captions and tweaking cuts." },
                            { icon: '📉', title: 'Inconsistent?', desc: 'Posting once then disappearing for weeks.' },
                        ].map((item) => (
                            <div key={item.title} className="glass-card p-8 bg-white">
                                <div className="text-4xl mb-4">{item.icon}</div>
                                <h3 className="text-xl font-black mb-2">{item.title}</h3>
                                <p className="text-[var(--text-secondary)] font-medium leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-20">
                        <span className="inline-block px-4 py-1 rounded-full border-2 border-black bg-[var(--brand-primary)] text-sm font-black uppercase tracking-wider mb-4 shadow-[4px_4px_0px_#000]">Simple Process</span>
                        <h2 className="heading-section">From thought to video in 3 steps</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12 relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-12 left-0 right-0 h-1 bg-black border-t-2 border-dashed border-gray-400 z-0"></div>

                        {[
                            { step: '01', title: 'Clone Voice', desc: 'Securely clone your voice with just 10 seconds of audio. Or choose from our pro library.' },
                            { step: '02', title: 'Upload Photo', desc: 'Upload one high-quality photo. We animate it to look natural and professional.' },
                            { step: '03', title: 'Generate', desc: 'Type your script or topic. We write, voice, animate, and caption it instantly.' },
                        ].map((item, i) => (
                            <motion.div
                                key={item.step}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                viewport={{ once: true }}
                                className="relative z-10 text-center"
                            >
                                <div className="w-24 h-24 mx-auto bg-white border-2 border-black rounded-full flex items-center justify-center text-3xl font-black shadow-[8px_8px_0px_var(--brand-primary)] mb-6">
                                    {item.step}
                                </div>
                                <h3 className="text-xl font-black mb-3">{item.title}</h3>
                                <p className="text-[var(--text-secondary)] font-medium leading-relaxed max-w-xs mx-auto">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Showcase Section */}
            <section id="showcase" className="py-24 px-6 bg-black relative overflow-hidden">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-black"></div>

                <div className="max-w-4xl mx-auto relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-12"
                    >
                        <span className="inline-block px-5 py-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-sm font-black uppercase tracking-wider mb-6">
                            🎬 See It In Action
                        </span>

                        <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                            From topic to <span className="text-[var(--brand-primary)]">finished reel</span>
                        </h2>

                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                            Just <strong className="text-white">one photo</strong> + <strong className="text-white">one voice sample</strong> → Professional video in <strong className="text-[var(--brand-primary)]">under 5 minutes</strong>
                        </p>
                    </motion.div>

                    {/* Video Showcase */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="relative"
                    >
                        <div className="relative mx-auto max-w-sm">
                            {/* Phone frame effect */}
                            <div className="absolute -inset-3 bg-gradient-to-br from-[var(--brand-primary)] via-yellow-400 to-[var(--brand-primary)] rounded-[2.5rem] blur-sm opacity-50"></div>
                            <div className="relative bg-black rounded-[2rem] p-2 border-4 border-zinc-800 shadow-2xl">
                                <video
                                    className="w-full aspect-[9/16] rounded-[1.5rem] object-cover bg-zinc-900"
                                    src="https://tfaumdiiljwnjmfnonrc.supabase.co/storage/v1/object/public/Showcase/2026-01-14-03812%20(1).mp4"
                                    controls
                                    playsInline
                                    preload="metadata"
                                    poster=""
                                >
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        </div>

                        {/* Stats badges */}
                        <div className="flex flex-wrap justify-center gap-4 mt-8">
                            <div className="px-4 py-2 rounded-full bg-zinc-800 border border-zinc-700 text-sm font-bold text-white">
                                ⏱️ 5 minutes total
                            </div>
                            <div className="px-4 py-2 rounded-full bg-zinc-800 border border-zinc-700 text-sm font-bold text-white">
                                📸 1 photo used
                            </div>
                            <div className="px-4 py-2 rounded-full bg-zinc-800 border border-zinc-700 text-sm font-bold text-white">
                                🎤 1 voice sample
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Lottery Ticket Section - Light Premium */}
            <section className="py-28 px-6 bg-gradient-to-b from-amber-50/80 via-[var(--surface-1)] to-white relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* Scattered golden dots */}
                    <div className="absolute top-[10%] left-[5%] w-3 h-3 bg-[var(--brand-primary)] rounded-full opacity-60"></div>
                    <div className="absolute top-[20%] right-[8%] w-4 h-4 bg-[var(--brand-primary)] rounded-full opacity-40"></div>
                    <div className="absolute bottom-[15%] left-[12%] w-2 h-2 bg-[var(--brand-primary)] rounded-full opacity-50"></div>
                    <div className="absolute bottom-[25%] right-[15%] w-3 h-3 bg-[var(--brand-primary)] rounded-full opacity-30"></div>

                    {/* Floating ticket decorations */}
                    <motion.div
                        animate={{ y: [-8, 8, -8], rotate: [-3, 3, -3] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute top-[18%] left-[6%] text-5xl md:text-6xl opacity-50 select-none"
                    >🎫</motion.div>
                    <motion.div
                        animate={{ y: [6, -6, 6], rotate: [4, -4, 4] }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        className="absolute top-[12%] right-[10%] text-4xl md:text-5xl opacity-40 select-none"
                    >🎟️</motion.div>
                    <motion.div
                        animate={{ y: [-5, 5, -5] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                        className="absolute bottom-[20%] right-[6%] text-4xl opacity-35 select-none"
                    >✨</motion.div>
                </div>

                <div className="max-w-5xl mx-auto relative z-10">
                    {/* Section Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <span className="inline-block px-5 py-2 rounded-full border-2 border-black bg-[var(--brand-primary)] text-sm font-black uppercase tracking-wider mb-6 shadow-[4px_4px_0px_#000]">
                            🎰 The Numbers Game
                        </span>

                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-[1.15]">
                            Every piece of content<br />
                            is a{' '}
                            <span className="relative inline-block">
                                <span className="relative z-10 bg-[var(--brand-primary)] text-black px-2 py-1 rounded-md">lottery ticket</span>
                            </span>
                        </h2>

                        <p className="text-xl md:text-2xl font-bold text-[var(--text-secondary)] max-w-2xl mx-auto">
                            So maximize your chances of{' '}
                            <span className="bg-[var(--brand-primary)] text-black px-2 py-0.5 rounded">winning</span>.
                        </p>
                    </motion.div>

                    {/* The ONE Cards - Ticket Style */}
                    <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-16">
                        {[
                            { emoji: '🤝', one: 'ONE reel', result: 'to land that dream client' },
                            { emoji: '💼', one: 'ONE video', result: 'to close that big deal' },
                            { emoji: '⭐', one: 'ONE post', result: 'to get noticed by someone BIG' },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 25, rotate: i === 1 ? 0 : (i === 0 ? -2 : 2) }}
                                whileInView={{ opacity: 1, y: 0, rotate: i === 1 ? 0 : (i === 0 ? -1 : 1) }}
                                transition={{ delay: i * 0.12 }}
                                viewport={{ once: true }}
                                whileHover={{ y: -8, rotate: 0 }}
                                className="relative"
                            >
                                {/* Ticket card with perforated edge effect */}
                                <div className="bg-white border-2 border-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_#000] hover:shadow-[12px_12px_0px_var(--brand-primary)] transition-all duration-300">
                                    {/* Ticket header */}
                                    <div className="bg-[var(--brand-primary)] py-3 px-5 border-b-2 border-black">
                                        <span className="text-4xl">{item.emoji}</span>
                                    </div>
                                    {/* Ticket body */}
                                    <div className="p-6 text-center">
                                        <p className="text-3xl font-black text-black mb-2">{item.one}</p>
                                        <p className="text-base font-bold text-[var(--text-secondary)]">{item.result}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* The Solution */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="relative"
                    >
                        <div className="bg-white border-2 border-black rounded-[2rem] p-8 md:p-12 shadow-[10px_10px_0px_#000] relative overflow-hidden">
                            {/* Corner accent */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--brand-primary)] rounded-bl-[2rem]"></div>
                            <div className="absolute top-3 right-4 text-2xl font-black rotate-12">⚡</div>

                            <div className="text-center relative z-10">
                                <h3 className="text-2xl md:text-4xl font-black mb-4">
                                    Reven makes posting{' '}
                                    <span className="bg-black text-[var(--brand-primary)] px-3 py-1 rounded-lg">stupidly easy</span>
                                </h3>
                                <p className="text-lg md:text-xl text-[var(--text-secondary)] mb-10 max-w-xl mx-auto font-medium">
                                    You just decide <strong className="text-black">what to say</strong>. We handle everything else.
                                </p>

                                {/* Crossed out hassles */}
                                <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                                    {[
                                        '🎬 Recording on camera',
                                        '📜 Memorizing scripts',
                                        '🖼️ Hunting for assets',
                                        '✂️ Editing for hours',
                                    ].map((item, i) => (
                                        <motion.span
                                            key={item}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            whileInView={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: i * 0.08 }}
                                            viewport={{ once: true }}
                                            className="inline-block px-4 py-2.5 rounded-full border-2 border-black/20 bg-gray-100 font-bold text-sm text-gray-600 line-through decoration-red-500 decoration-2"
                                        >
                                            {item}
                                        </motion.span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 px-6 bg-black text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-black mb-6">
                            Your personal <span className="text-[var(--brand-primary)]">content studio</span>
                        </h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            Everything you need to build a personal brand, automated.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { icon: '🧠', title: 'AI Script Writer', desc: 'Turn vague ideas into viral-ready hooks and scripts.' },
                            { icon: '🎙️', title: 'Voice Cloning', desc: 'Your voice, perfectly replicated. No recording needed.' },
                            { icon: '👤', title: 'Photo Animation', desc: 'State-of-the-art lip sync and facial movement.' },
                            { icon: '📝', title: 'Auto Captions', desc: 'Hardcoded subtitles that keep viewers watching.' },
                            { icon: '🎨', title: 'Brand Styles', desc: 'Consistent fonts and colors for your personal brand.' },
                            { icon: '📱', title: 'Social Ready', desc: 'Optimized vertical 9:16 format for Reels & TikTok.' },
                        ].map((feature, i) => (
                            <div key={feature.title} className="p-6 border-2 border-zinc-800 bg-zinc-900/50 rounded-[var(--radius-xl)] hover:border-[var(--brand-primary)] transition-colors group">
                                <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">{feature.icon}</div>
                                <h3 className="font-bold text-lg mb-2 text-white">{feature.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="heading-hero mb-8">
                        Stop hiding behind text. <br />
                        Start <span className="bg-[var(--brand-primary)] text-black px-2">showing up</span>.
                    </h2>

                    <div className="flex flex-col items-center gap-6">
                        <SignedOut>
                            <SignUpButton mode="modal">
                                <div className="group relative inline-block cursor-pointer">
                                    <div className="absolute top-0 left-0 w-full h-full bg-black rounded-[var(--radius-lg)] translate-x-2 translate-y-2 transition-transform group-hover:translate-x-3 group-hover:translate-y-3"></div>
                                    <button className="relative px-12 py-5 bg-[var(--brand-primary)] border-2 border-black rounded-[var(--radius-lg)] text-xl font-black uppercase tracking-wide hover:-translate-y-1 transition-transform">
                                        Create First Video Free
                                    </button>
                                </div>
                            </SignUpButton>
                        </SignedOut>
                        <SignedIn>
                            <Link href="/dashboard">
                                <div className="group relative inline-block cursor-pointer">
                                    <div className="absolute top-0 left-0 w-full h-full bg-black rounded-[var(--radius-lg)] translate-x-2 translate-y-2 transition-transform group-hover:translate-x-3 group-hover:translate-y-3"></div>
                                    <button className="relative px-12 py-5 bg-[var(--brand-primary)] border-2 border-black rounded-[var(--radius-lg)] text-xl font-black uppercase tracking-wide hover:-translate-y-1 transition-transform">
                                        Go to Dashboard
                                    </button>
                                </div>
                            </Link>
                        </SignedIn>
                        <p className="text-sm font-bold text-[var(--text-secondary)] mt-4">
                            No credit card required. Up to 1 min free.
                        </p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t-2 border-black bg-white">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-black flex items-center justify-center">
                            <span className="text-[var(--brand-primary)] font-black text-xs">R</span>
                        </div>
                        <span className="font-black text-lg">Reven - Pocket Creator</span>
                    </div>
                    <div className="flex gap-8 text-sm font-bold text-[var(--text-secondary)]">
                        <Link href="/privacy" className="hover:text-black">Privacy</Link>
                        <Link href="/terms" className="hover:text-black">Terms</Link>
                        <a href="https://x.com/avid_abhay" target="_blank" rel="noopener noreferrer" className="hover:text-black">𝕏</a>
                        <a href="https://wa.me/918587880823" target="_blank" rel="noopener noreferrer" className="hover:text-black">WhatsApp</a>
                    </div>
                    <p className="text-sm font-bold text-[var(--text-tertiary)]">© 2026 Reven</p>
                </div>
            </footer>
        </div>
    );
}
