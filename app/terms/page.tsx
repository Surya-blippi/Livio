'use client';

import Link from 'next/link';

export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-[var(--surface-1)] text-[var(--text-primary)] font-sans">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 border-b-2 border-[var(--border-strong)] bg-[var(--surface-1)]/90 backdrop-blur-md">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--brand-primary)] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <span className="text-black font-black text-xl">R</span>
                        </div>
                        <span className="text-xl font-black tracking-tight">Reven</span>
                    </Link>
                    <Link href="/" className="font-bold hover:text-[var(--text-secondary)] transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            </nav>

            {/* Content */}
            <main className="pt-28 pb-16 px-6">
                <article className="max-w-3xl mx-auto prose prose-lg">
                    <h1 className="text-4xl md:text-5xl font-black mb-2">Terms of Service</h1>
                    <p className="text-[var(--text-secondary)] text-lg mb-12">Last updated: January 19, 2026</p>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">1. Acceptance of Terms</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            By accessing or using Reven (&quot;the Service&quot;), operated by Reven Technologies (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">2. Description of Service</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            Reven is an AI-powered video creation platform that enables users to create professional video content using:
                        </p>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li>AI-generated avatars from uploaded photos</li>
                            <li>Voice cloning technology from audio samples</li>
                            <li>AI-assisted script writing</li>
                            <li>Automated video editing and caption generation</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">3. User Accounts</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            To use certain features of the Service, you must create an account. You agree to:
                        </p>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li>Provide accurate, current, and complete information</li>
                            <li>Maintain the security of your account credentials</li>
                            <li>Accept responsibility for all activities under your account</li>
                            <li>Notify us immediately of any unauthorized use</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">4. User Content</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            <strong className="text-black">Your Content:</strong> You retain ownership of all content you upload, including photos, voice recordings, and scripts (&quot;User Content&quot;). By uploading content, you grant us a limited license to process, store, and use it solely for providing the Service.
                        </p>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            <strong className="text-black">Content Restrictions:</strong> You agree not to upload content that:
                        </p>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li>Infringes on intellectual property rights of others</li>
                            <li>Contains images or voices of individuals without their consent</li>
                            <li>Is defamatory, obscene, or promotes illegal activities</li>
                            <li>Misrepresents identity or impersonates others maliciously</li>
                            <li>Violates any applicable laws or regulations</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">5. AI-Generated Content</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            Videos created using our Service are AI-generated. You acknowledge that:
                        </p>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li>AI-generated content may contain imperfections</li>
                            <li>You are responsible for reviewing content before publishing</li>
                            <li>You must clearly disclose AI involvement when required by platform policies or laws</li>
                            <li>Generated content should not be used for fraud, deception, or misinformation</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">6. Credits and Payments</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            The Service operates on a credit-based system. Credits are:
                        </p>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li>Non-refundable once purchased</li>
                            <li>Non-transferable between accounts</li>
                            <li>Subject to expiration as specified at time of purchase</li>
                            <li>Consumed based on video length and features used</li>
                        </ul>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                            All payments are processed securely through our payment partners. Prices are subject to change with notice.
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">7. Intellectual Property</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            The Service, including its design, features, and underlying technology, is owned by Reven Technologies and protected by intellectual property laws. You may not copy, modify, or reverse-engineer any part of the Service.
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">8. Termination</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            We may suspend or terminate your access to the Service at any time for violation of these terms or for any other reason at our discretion. Upon termination:
                        </p>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2">
                            <li>Your right to use the Service ceases immediately</li>
                            <li>We may delete your account data after a reasonable period</li>
                            <li>Unused credits will not be refunded</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">9. Disclaimers</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE UNINTERRUPTED OR ERROR-FREE OPERATION. WE ARE NOT LIABLE FOR ANY DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">10. Limitation of Liability</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            To the maximum extent permitted by law, our total liability for any claims arising from your use of the Service shall not exceed the amount you paid us in the past 12 months.
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">11. Changes to Terms</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            We may update these Terms of Service from time to time. We will notify you of significant changes via email or through the Service. Continued use after changes constitutes acceptance.
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">12. Contact</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                            For questions about these Terms of Service, please contact us at{' '}
                            <a href="mailto:hello@reven.in" className="text-black font-bold underline">hello@reven.in</a>
                        </p>
                    </section>
                </article>
            </main>

            {/* Footer */}
            <footer className="py-8 px-6 border-t-2 border-black bg-white">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-sm font-bold text-[var(--text-tertiary)]">© 2026 Reven Technologies</p>
                    <div className="flex gap-6 text-sm font-bold">
                        <Link href="/privacy" className="hover:text-black text-[var(--text-secondary)]">Privacy Policy</Link>
                        <Link href="/terms" className="text-black">Terms of Service</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
