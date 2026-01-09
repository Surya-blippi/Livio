import React from 'react';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-[var(--surface-1)] text-[var(--text-primary)] transition-colors duration-300 font-sans">
            {/* 
              Grid Layout Strategy:
              Mobile: Stacked (Nav on top, Content below)
              Desktop: Sidebar (Fixed) + Content (Scrollable)
             */}
            <div className="flex flex-col lg:flex-row h-screen overflow-hidden">
                {/* 
                  Sidebar Placeholder 
                  (Will be replaced by actual Sidebar component later)
                */}
                <aside className="hidden lg:flex w-64 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-2)] z-20">
                    {/* Sidebar content will be injected here via children or composition */}
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto relative h-full">
                    <div className="max-w-[1600px] mx-auto p-4 lg:p-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
