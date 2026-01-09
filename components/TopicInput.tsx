'use client';

import React, { useState } from 'react';
import { validateTopic } from '@/lib/validation';
import { motion } from 'framer-motion';

interface TopicInputProps {
    onTopicSubmit: (topic: string) => void;
    isLoading?: boolean;
}

const exampleTopics = [
    'The Future of Artificial Intelligence',
    'Sustainable Living Tips',
    'Mental Health and Wellness',
    'Space Exploration',
    'Healthy Eating Habits',
    'Digital Marketing Strategies'
];

export default function TopicInput({ onTopicSubmit, isLoading = false }: TopicInputProps) {
    const [topic, setTopic] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        const validation = validateTopic(topic);

        if (!validation.valid) {
            setError(validation.error || 'Invalid topic');
            return;
        }

        setError('');
        onTopicSubmit(topic);
    };

    const handleExampleClick = (example: string) => {
        setTopic(example);
        setError('');
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h2 className="text-3xl font-bold mb-2 gradient-text text-center">
                    What's Your Topic?
                </h2>
                <p className="text-gray-400 text-center mb-8">
                    Tell us what you'd like to talk about
                </p>

                <div className="glass-strong p-8">
                    <label htmlFor="topic" className="block text-sm font-medium mb-3">
                        Enter your topic
                    </label>

                    <input
                        id="topic"
                        type="text"
                        value={topic}
                        onChange={(e) => {
                            setTopic(e.target.value);
                            setError('');
                        }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !isLoading) {
                                handleSubmit();
                            }
                        }}
                        placeholder="e.g., The Future of AI"
                        className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-white placeholder-gray-500"
                        disabled={isLoading}
                        maxLength={200}
                    />

                    <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                        <span>{topic.length}/200 characters</span>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm"
                        >
                            {error}
                        </motion.div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !topic.trim()}
                        className="w-full mt-6 btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="spinner border-white border-t-purple-300 w-5 h-5" />
                                Generating Script...
                            </>
                        ) : (
                            <>
                                Generate Script ✨
                            </>
                        )}
                    </button>
                </div>

                {/* Example topics */}
                <div className="mt-8">
                    <p className="text-sm text-gray-500 mb-3 text-center">
                        Need inspiration? Try these:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {exampleTopics.map((example, index) => (
                            <motion.button
                                key={index}
                                onClick={() => handleExampleClick(example)}
                                className="glass px-4 py-2 text-sm rounded-full hover:bg-white/10 transition-colors"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                disabled={isLoading}
                            >
                                {example}
                            </motion.button>
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
