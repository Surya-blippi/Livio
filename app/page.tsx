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
                            <SignInButton mode="modal">
                                <button className="font-bold hover:opacity-70 transition-opacity">
                                    Log in
                                </button>
                            </SignInButton>
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

            {/* Lottery Ticket Section - Premium Redesign */}
            <section className="py-32 px-6 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 relative overflow-hidden">
                {/* Animated Background Elements */}
                <div className="absolute inset-0">
                    {/* Glowing orbs */}
                    <div className="absolute top-20 left-10 w-96 h-96 bg-[var(--brand-primary)]/20 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute bottom-20 right-10 w-80 h-80 bg-purple-500/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--brand-primary)]/5 rounded-full blur-[150px]"></div>

                    {/* Floating ticket emojis */}
                    <motion.div
                        animate={{ y: [-10, 10, -10], rotate: [-5, 5, -5] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute top-[15%] left-[8%] text-6xl opacity-20"
                    >🎫</motion.div>
                    <motion.div
                        animate={{ y: [10, -10, 10], rotate: [5, -5, 5] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                        className="absolute top-[25%] right-[12%] text-5xl opacity-15"
                    >🎟️</motion.div>
                    <motion.div
                        animate={{ y: [-15, 15, -15], rotate: [-8, 8, -8] }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        className="absolute bottom-[20%] left-[15%] text-4xl opacity-20"
                    >✨</motion.div>
                    <motion.div
                        animate={{ y: [15, -15, 15] }}
                        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                        className="absolute bottom-[30%] right-[8%] text-5xl opacity-15"
                    >🎰</motion.div>
                </div>

                <div className="max-w-5xl mx-auto relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center"
                    >
                        {/* Glowing Badge */}
                        <motion.span
                            initial={{ scale: 0.9 }}
                            whileInView={{ scale: 1 }}
                            viewport={{ once: true }}
                            className="inline-block px-6 py-2 rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-yellow-400 text-black text-sm font-black uppercase tracking-widest mb-8 shadow-[0_0_40px_rgba(255,220,0,0.3)]"
                        >
                            🎫 The Content Game
                        </motion.span>

                        {/* Epic Headline */}
                        <h2 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 leading-[1.1]">
                            Every post is a{' '}
                            <span className="relative inline-block">
                                <span className="relative z-10 bg-gradient-to-r from-[var(--brand-primary)] via-yellow-300 to-[var(--brand-primary)] bg-clip-text text-transparent">
                                    lottery ticket
                                </span>
                                <motion.span
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute -inset-2 bg-[var(--brand-primary)]/20 blur-xl rounded-lg"
                                ></motion.span>
                            </span>
                        </h2>

                        <p className="text-2xl md:text-3xl font-bold text-zinc-400 max-w-3xl mx-auto leading-relaxed mb-16">
                            Maximize your chances of <span className="text-white">winning</span>.
                        </p>

                        {/* Premium Glass Cards */}
                        <div className="grid md:grid-cols-3 gap-6 mb-16">
                            {[
                                { emoji: '🤝', highlight: 'ONE reel', text: 'to close that client' },
                                { emoji: '💼', highlight: 'ONE video', text: 'to close that deal' },
                                { emoji: '🌟', highlight: 'ONE post', text: 'to get noticed by someone BIG' },
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.15 }}
                                    viewport={{ once: true }}
                                    whileHover={{ scale: 1.03, y: -5 }}
                                    className="group relative p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-[var(--brand-primary)]/50 transition-all duration-300 overflow-hidden"
                                >
                                    {/* Hover glow */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-primary)]/0 to-[var(--brand-primary)]/0 group-hover:from-[var(--brand-primary)]/10 group-hover:to-transparent transition-all duration-500 rounded-2xl"></div>

                                    <span className="text-5xl mb-4 block relative z-10 group-hover:scale-110 transition-transform duration-300">{item.emoji}</span>
                                    <p className="text-xl font-black text-white leading-tight relative z-10">
                                        <span className="text-[var(--brand-primary)]">{item.highlight}</span>
                                        <br />
                                        <span className="text-zinc-400 font-bold">{item.text}</span>
                                    </p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Striking Solution Block */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="relative p-10 md:p-14 rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-950 border-2 border-[var(--brand-primary)]/30 overflow-hidden"
                        >
                            {/* Inner glow */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-1 bg-gradient-to-r from-transparent via-[var(--brand-primary)] to-transparent"></div>
                            <div className="absolute inset-0 bg-gradient-to-b from-[var(--brand-primary)]/5 to-transparent pointer-events-none"></div>

                            <h3 className="text-3xl md:text-4xl font-black text-white mb-4 relative z-10">
                                Reven makes consistency{' '}
                                <span className="bg-gradient-to-r from-[var(--brand-primary)] to-yellow-400 bg-clip-text text-transparent">stupidly easy</span>
                            </h3>
                            <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed relative z-10">
                                You focus on <strong className="text-white">what to say</strong>. We handle absolutely everything else.
                            </p>

                            {/* Crossed out hassles - Premium style */}
                            <div className="flex flex-wrap justify-center gap-4 relative z-10">
                                {[
                                    { icon: '🎬', text: 'Recording yourself' },
                                    { icon: '📜', text: 'Memorizing scripts' },
                                    { icon: '🖼️', text: 'Finding assets' },
                                    { icon: '✂️', text: 'Editing videos' },
                                ].map((item, i) => (
                                    <motion.span
                                        key={item.text}
                                        initial={{ opacity: 0, x: -10 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        viewport={{ once: true }}
                                        className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-zinc-800/80 border border-zinc-700/50 font-bold text-base text-zinc-500"
                                    >
                                        <span>{item.icon}</span>
                                        <span className="line-through decoration-[var(--brand-primary)] decoration-2">{item.text}</span>
                                    </motion.span>
                                ))}
                            </div>
                        </motion.div>
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
                        <a href="#" className="hover:text-black">Privacy</a>
                        <a href="#" className="hover:text-black">Terms</a>
                        <a href="#" className="hover:text-black">Twitter</a>
                    </div>
                    <p className="text-sm font-bold text-[var(--text-tertiary)]">© 2026 Reven - Pocket Creator</p>
                </div>
            </footer>
        </div>
    );
}
