'use client';

import Link from 'next/link';

export default function PrivacyPolicyPage() {
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
                    <h1 className="text-4xl md:text-5xl font-black mb-2">Privacy Policy</h1>
                    <p className="text-[var(--text-secondary)] text-lg mb-12">Last updated: January 19, 2026</p>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">1. Introduction</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            Reven Technologies (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI video creation platform (&quot;the Service&quot;).
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">2. Information We Collect</h2>

                        <h3 className="text-xl font-bold mt-6 mb-3">2.1 Information You Provide</h3>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li><strong className="text-black">Account Information:</strong> Name, email address, and authentication data via Clerk</li>
                            <li><strong className="text-black">Profile Photos:</strong> Images you upload to create AI avatars</li>
                            <li><strong className="text-black">Voice Recordings:</strong> Audio samples you provide for voice cloning</li>
                            <li><strong className="text-black">Video Scripts:</strong> Text content you write or generate for videos</li>
                            <li><strong className="text-black">Payment Information:</strong> Billing details processed by our payment partner (Dodo Payments)</li>
                        </ul>

                        <h3 className="text-xl font-bold mt-6 mb-3">2.2 Automatically Collected Information</h3>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li>Device and browser information</li>
                            <li>IP address and approximate location</li>
                            <li>Usage data and interaction with the Service</li>
                            <li>Cookies and similar tracking technologies</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">3. How We Use Your Information</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">We use collected information to:</p>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li>Provide and maintain the Service</li>
                            <li>Generate AI avatars from your photos</li>
                            <li>Create voice clones from your audio samples</li>
                            <li>Process video generation requests</li>
                            <li>Process payments and manage credits</li>
                            <li>Send service updates and notifications</li>
                            <li>Improve and optimize the Service</li>
                            <li>Detect and prevent fraud or abuse</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">4. Third-Party Services</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">We use trusted third-party services to provide the Service:</p>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li><strong className="text-black">Clerk:</strong> Authentication and user management</li>
                            <li><strong className="text-black">Supabase:</strong> Database and file storage</li>
                            <li><strong className="text-black">WaveSpeed/LivePortrait:</strong> AI avatar and lip-sync generation</li>
                            <li><strong className="text-black">ElevenLabs:</strong> Voice cloning (optional)</li>
                            <li><strong className="text-black">JSON2Video:</strong> Video rendering</li>
                            <li><strong className="text-black">Google Gemini:</strong> AI script writing and image search</li>
                            <li><strong className="text-black">Dodo Payments:</strong> Payment processing</li>
                        </ul>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                            Each third party has its own privacy policy governing their use of your data.
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">5. Data Storage and Security</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            Your data is stored securely using industry-standard practices:
                        </p>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li>All data is encrypted in transit using HTTPS/TLS</li>
                            <li>Files are stored in secure cloud storage with access controls</li>
                            <li>We implement regular security audits and updates</li>
                            <li>Access to personal data is restricted to authorized personnel</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">6. Data Retention</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">We retain your data as follows:</p>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li><strong className="text-black">Account Data:</strong> Retained while your account is active</li>
                            <li><strong className="text-black">Generated Videos:</strong> Stored until you delete them or close your account</li>
                            <li><strong className="text-black">Voice Clones:</strong> Stored until you delete them or close your account</li>
                            <li><strong className="text-black">Avatar Images:</strong> Stored until you delete them or close your account</li>
                            <li><strong className="text-black">Payment Records:</strong> Retained as required by law (typically 7 years)</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">7. Your Rights</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">Depending on your location, you may have the right to:</p>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li><strong className="text-black">Access:</strong> Request a copy of your personal data</li>
                            <li><strong className="text-black">Correct:</strong> Update inaccurate or incomplete data</li>
                            <li><strong className="text-black">Delete:</strong> Request deletion of your personal data</li>
                            <li><strong className="text-black">Export:</strong> Receive your data in a portable format</li>
                            <li><strong className="text-black">Object:</strong> Opt out of certain processing activities</li>
                        </ul>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                            To exercise these rights, contact us at <a href="mailto:privacy@reven.ai" className="text-black font-bold underline">privacy@reven.ai</a>.
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">8. Cookies</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            We use cookies and similar technologies to:
                        </p>
                        <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mb-4">
                            <li>Keep you signed in to your account</li>
                            <li>Remember your preferences</li>
                            <li>Analyze how the Service is used</li>
                            <li>Improve performance and user experience</li>
                        </ul>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                            You can control cookies through your browser settings, though this may affect functionality.
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">9. Children&apos;s Privacy</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            The Service is not intended for children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us immediately.
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">10. International Data Transfers</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            Your data may be processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers, including standard contractual clauses where applicable.
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">11. Changes to This Policy</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                            We may update this Privacy Policy periodically. We will notify you of significant changes via email or through the Service. Continued use after changes constitutes acceptance.
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-2xl font-black mb-4">12. Contact Us</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                            For questions about this Privacy Policy or your data, contact us at:{' '}
                            <a href="mailto:privacy@reven.ai" className="text-black font-bold underline">privacy@reven.ai</a>
                        </p>
                    </section>
                </article>
            </main>

            {/* Footer */}
            <footer className="py-8 px-6 border-t-2 border-black bg-white">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-sm font-bold text-[var(--text-tertiary)]">© 2026 Reven Technologies</p>
                    <div className="flex gap-6 text-sm font-bold">
                        <Link href="/privacy" className="text-black">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-black text-[var(--text-secondary)]">Terms of Service</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
