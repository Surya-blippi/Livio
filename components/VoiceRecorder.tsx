'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { validateAudioFile, getAudioDuration } from '@/lib/fileUpload';
import { validateAudioDuration } from '@/lib/validation';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceRecorderProps {
    onVoiceReady: (audioFile: File) => void;
    isProcessing?: boolean;
}

export default function VoiceRecorder({ onVoiceReady, isProcessing = false }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<'record' | 'upload'>('record');
    const [audioDuration, setAudioDuration] = useState<number>(0);

    // Cleanup object URL to prevent memory leaks
    useEffect(() => {
        if (audioBlob) {
            const url = URL.createObjectURL(audioBlob);
            setAudioPreviewUrl(url);
            return () => {
                URL.revokeObjectURL(url);
                setAudioPreviewUrl(null);
            };
        } else {
            setAudioPreviewUrl(null);
        }
    }, [audioBlob]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

    // Start recording
    const startRecording = async () => {
        try {
            setError('');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
                setAudioBlob(blob);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error('Error accessing microphone:', err);
            setError('Could not access microphone. Please grant permission and try again.');
        }
    };

    // Stop recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
    };

    // Handle file upload via dropzone
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setError('');

        if (acceptedFiles.length === 0) {
            return;
        }

        const file = acceptedFiles[0];
        const validation = validateAudioFile(file);

        if (!validation.valid) {
            setError(validation.error || 'Invalid file');
            return;
        }

        try {
            const duration = await getAudioDuration(file);
            setAudioDuration(duration);

            const durationValidation = validateAudioDuration(duration);
            if (!durationValidation.valid) {
                setError(durationValidation.error || 'Invalid duration');
                return;
            }

            setAudioFile(file);
        } catch (err) {
            setError('Could not read audio file');
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'audio/wav': ['.wav'],
            'audio/mpeg': ['.mp3'],
            'audio/webm': ['.webm']
        },
        maxFiles: 1,
        multiple: false
    });

    // Handle recorded audio confirmation
    const handleRecordedAudioConfirm = async () => {
        if (!audioBlob) return;

        const durationValidation = validateAudioDuration(recordingTime);
        if (!durationValidation.valid) {
            setError(durationValidation.error || 'Recording too short');
            return;
        }

        const file = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
        onVoiceReady(file);
    };

    // Handle uploaded audio confirmation
    const handleUploadedAudioConfirm = () => {
        if (!audioFile) return;
        onVoiceReady(audioFile);
    };

    // Format time
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    const minDuration = 10;
    const isRecordingValidLength = recordingTime >= minDuration;
    const isUploadValidLength = audioDuration >= minDuration;

    return (
        <div className="w-full max-w-2xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h2 className="text-3xl font-bold mb-2 gradient-text text-center">
                    Record Your Voice
                </h2>
                <p className="text-gray-400 text-center mb-8">
                    We'll clone your voice to narrate the script
                </p>

                {/* Mode selector */}
                <div className="flex gap-2 mb-6 glass p-1 rounded-lg w-fit mx-auto">
                    <button
                        onClick={() => setMode('record')}
                        className={`px-6 py-2 rounded-md transition-all ${mode === 'record'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        🎤 Record
                    </button>
                    <button
                        onClick={() => setMode('upload')}
                        className={`px-6 py-2 rounded-md transition-all ${mode === 'upload'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        📁 Upload
                    </button>
                </div>

                <div className="glass-strong p-8">
                    <AnimatePresence mode="wait">
                        {mode === 'record' ? (
                            <motion.div
                                key="record"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                {/* Recording interface */}
                                <div className="text-center">
                                    <div className="mb-6">
                                        <div className={`mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center ${isRecording ? 'pulse-recording' : ''
                                            }`}>
                                            <svg
                                                className="w-12 h-12 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    </div>

                                    <div className="text-4xl font-bold mb-2 gradient-text">
                                        {formatTime(recordingTime)}
                                    </div>

                                    <p className="text-sm text-gray-400 mb-6">
                                        {isRecording
                                            ? isRecordingValidLength
                                                ? '✓ Minimum duration reached'
                                                : `Keep talking... (${minDuration - recordingTime}s left)`
                                            : 'Click to start recording'}
                                    </p>

                                    {!audioBlob ? (
                                        <button
                                            onClick={isRecording ? stopRecording : startRecording}
                                            className={`btn-primary ${isRecording ? 'bg-red-500 hover:bg-red-600' : ''}`}
                                        >
                                            {isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
                                        </button>
                                    ) : (
                                        <div>
                                            <audio
                                                ref={audioPreviewRef}
                                                src={audioPreviewUrl || ''}
                                                controls
                                                className="w-full mb-4"
                                            />

                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => {
                                                        setAudioBlob(null);
                                                        setRecordingTime(0);
                                                    }}
                                                    className="flex-1 btn-secondary"
                                                >
                                                    🔄 Re-record
                                                </button>
                                                <button
                                                    onClick={handleRecordedAudioConfirm}
                                                    disabled={!isRecordingValidLength || isProcessing}
                                                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isProcessing ? (
                                                        <>
                                                            <div className="spinner inline-block mr-2 w-5 h-5" />
                                                            Processing...
                                                        </>
                                                    ) : (
                                                        'Continue →'
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="upload"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                {/* Upload interface */}
                                {!audioFile ? (
                                    <div
                                        {...getRootProps()}
                                        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600'
                                            }`}
                                    >
                                        <input {...getInputProps()} />

                                        <div className="mb-4">
                                            <svg
                                                className="mx-auto h-16 w-16 text-gray-400"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                                />
                                            </svg>
                                        </div>

                                        {isDragActive ? (
                                            <p className="text-xl text-purple-400 font-medium">
                                                Drop your audio file here
                                            </p>
                                        ) : (
                                            <>
                                                <p className="text-xl mb-2">
                                                    Drag & drop your audio file
                                                </p>
                                                <p className="text-gray-500 mb-4">or</p>
                                                <button className="btn-primary">
                                                    Browse Files
                                                </button>
                                                <p className="text-sm text-gray-500 mt-4">
                                                    Supports: WAV, MP3 (min {minDuration}s, max 25MB)
                                                </p>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <p className="text-green-400 mb-4">
                                            ✓ Audio file ready ({audioDuration.toFixed(1)}s)
                                        </p>
                                        <audio
                                            src={URL.createObjectURL(audioFile)}
                                            controls
                                            className="w-full mb-4"
                                        />

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => {
                                                    setAudioFile(null);
                                                    setAudioDuration(0);
                                                }}
                                                className="flex-1 btn-secondary"
                                            >
                                                🔄 Choose Different File
                                            </button>
                                            <button
                                                onClick={handleUploadedAudioConfirm}
                                                disabled={!isUploadValidLength || isProcessing}
                                                className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <div className="spinner inline-block mr-2 w-5 h-5" />
                                                        Processing...
                                                    </>
                                                ) : (
                                                    'Continue →'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm"
                        >
                            {error}
                        </motion.div>
                    )}

                    {/* Info box */}
                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-blue-300">
                            <strong>💡 Tip:</strong> For best results, speak clearly in a quiet environment.
                            The audio must be at least {minDuration} seconds long.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
