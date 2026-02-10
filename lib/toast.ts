export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastPayload {
    message: string;
    type?: ToastType;
    durationMs?: number;
}

const TOAST_EVENT = 'app:toast';

export function getToastEventName() {
    return TOAST_EVENT;
}

export function showToast(payload: ToastPayload | string) {
    if (typeof window === 'undefined') return;

    const normalized: ToastPayload =
        typeof payload === 'string'
            ? { message: payload, type: 'info' }
            : payload;

    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: normalized }));
}

