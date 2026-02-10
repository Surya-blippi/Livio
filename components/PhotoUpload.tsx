'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { validateImageFile } from '@/lib/fileUpload';
import { motion } from 'framer-motion';

interface PhotoUploadProps {
    onPhotoSelect: (file: File) => void;
    selectedPhoto: File | null;
}

export default function PhotoUpload({ onPhotoSelect, selectedPhoto }: PhotoUploadProps) {
    const [error, setError] = React.useState<string>('');
    const [preview, setPreview] = React.useState<string>('');

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setError('');

        if (acceptedFiles.length === 0) {
            return;
        }

        const file = acceptedFiles[0];
        const validation = validateImageFile(file);

        if (!validation.valid) {
            setError(validation.error || 'Invalid file');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        onPhotoSelect(file);
    }, [onPhotoSelect]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/webp': ['.webp']
        },
        maxFiles: 1,
        multiple: false
    });

    return (
        <div className="w-full max-w-2xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h2 className="text-3xl font-bold mb-2 gradient-text text-center">
                    Upload Your Photo
                </h2>
                <p className="text-[var(--text-secondary)] text-center mb-8">
                    Choose a clear photo where your face is visible
                </p>

                <div
                    {...getRootProps()}
                    className={`glass-strong p-8 border-2 border-dashed transition-all duration-300 cursor-pointer card-hover ${isDragActive ? 'border-[var(--brand-primary)] bg-[var(--surface-2)]' : 'border-[var(--border-subtle)]'
                        }`}
                >
                    <input {...getInputProps()} />

                    {preview ? (
                        <div className="text-center">
                            <div className="relative inline-block">
                                <img
                                    src={preview}
                                    alt="Preview"
                                    className="max-h-96 rounded-lg shadow-2xl"
                                />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPreview('');
                                        onPhotoSelect(null as unknown as File);
                                    }}
                                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                            <p className="mt-4 text-green-400 font-medium">
                                ✓ Photo ready
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="mb-4">
                                <svg
                                    className="mx-auto h-16 w-16 text-gray-400"
                                    stroke="currentColor"
                                    fill="none"
                                    viewBox="0 0 48 48"
                                >
                                    <path
                                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>

                            {isDragActive ? (
                                <p className="text-xl text-[var(--text-primary)] font-medium">
                                    Drop your photo here
                                </p>
                            ) : (
                                <>
                                    <p className="text-xl mb-2">
                                        Drag & drop your photo here
                                    </p>
                                    <p className="text-gray-500 mb-4">or</p>
                                    <button className="btn-primary">
                                        Browse Files
                                    </button>
                                    <p className="text-sm text-gray-500 mt-4">
                                        Supports: JPG, PNG, WebP (max 10MB)
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300"
                    >
                        {error}
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
