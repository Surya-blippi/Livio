'use client';

import { CreditsProvider } from './context/CreditsContext';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <CreditsProvider>
            {children}
        </CreditsProvider>
    );
}
