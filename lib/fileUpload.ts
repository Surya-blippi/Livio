/**
 * Convert a File object to base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
        };
        reader.onerror = (error) => reject(error);
    });
};

/**
 * Convert base64 to Blob
 */
export const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteString = atob(base64.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeType });
};

/**
 * Upload file to a temporary URL (for API consumption)
 * In production, you might want to use a proper file storage service
 */
export const uploadToTemporaryStorage = async (file: File): Promise<string> => {
    // For now, we'll use base64 encoding
    // In production, upload to S3/Cloudinary/etc and return public URL
    const base64 = await fileToBase64(file);
    return base64;
};

/**
 * Validate image file
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'Invalid file type. Please upload a JPG, PNG, or WebP image.'
        };
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'File too large. Maximum size is 10MB.'
        };
    }

    return { valid: true };
};

/**
 * Validate audio file
 */
export const validateAudioFile = (file: File): { valid: boolean; error?: string } => {
    const validTypes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/webm'];
    const maxSize = 25 * 1024 * 1024; // 25MB

    if (!validTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'Invalid file type. Please upload a WAV or MP3 audio file.'
        };
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'File too large. Maximum size is 25MB.'
        };
    }

    return { valid: true };
};

/**
 * Get audio duration from File
 */
export const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration);
        });
        audio.addEventListener('error', () => {
            reject(new Error('Failed to load audio file'));
        });
        audio.src = URL.createObjectURL(file);
    });
};
