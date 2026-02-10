'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getToastEventName, ToastPayload, ToastType } from '@/lib/toast';

interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
    durationMs: number;
}

const TYPE_STYLES: Record<ToastType, string> = {
    success: 'bg-emerald-50 border-emerald-500 text-emerald-700',
    error: 'bg-red-50 border-red-500 text-red-700',
    info: 'bg-blue-50 border-blue-500 text-blue-700',
    warning: 'bg-amber-50 border-amber-500 text-amber-700',
};

export function GlobalToast() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        const onToast = (event: Event) => {
            const customEvent = event as CustomEvent<ToastPayload>;
            const payload = customEvent.detail;
            if (!payload?.message) return;

            const item: ToastItem = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                message: payload.message,
                type: payload.type ?? 'info',
                durationMs: payload.durationMs ?? 3600,
            };

            setToasts((prev) => [...prev, item]);
        };

        const eventName = getToastEventName();
        window.addEventListener(eventName, onToast);
        return () => window.removeEventListener(eventName, onToast);
    }, []);

    useEffect(() => {
        if (toasts.length === 0) return;

        const timers = toasts.map((toast) =>
            window.setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== toast.id));
            }, toast.durationMs)
        );

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [toasts]);

    const visibleToasts = useMemo(() => toasts.slice(-4), [toasts]);

    if (visibleToasts.length === 0) return null;

    return (
        <div
            className="fixed top-4 right-4 z-[100000] flex w-[min(92vw,360px)] flex-col gap-2"
            aria-live="polite"
            aria-atomic="true"
        >
            {visibleToasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`rounded-xl border-2 px-4 py-3 shadow-[3px_3px_0px_#000] ${TYPE_STYLES[toast.type]}`}
                    role="status"
                >
                    <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold leading-snug">{toast.message}</p>
                        <button
                            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                            className="mt-0.5 text-xs font-black opacity-70 hover:opacity-100 focus:outline-none"
                            aria-label="Dismiss notification"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

