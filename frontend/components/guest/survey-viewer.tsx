/**
 * Survey Viewer Component
 * Displays and allows guests to complete satisfaction surveys
 */

'use client';

import { useState } from 'react';
import { Star, Send, CheckCircle2 } from 'lucide-react';

interface Survey {
    id: string;
    title: string;
    description: string;
    questions: any;
}

interface SurveyViewerProps {
    surveys: Survey[];
    roomStayId: string;
    roomNumber: string;
}

export function SurveyViewer({ surveys, roomStayId, roomNumber }: SurveyViewerProps) {
    const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [guestFeedback, setGuestFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    async function handleSubmit() {
        if (!selectedSurvey) return;

        setIsSubmitting(true);

        try {
            const response = await fetch('/api/guest/survey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    survey_id: selectedSurvey.id,
                    room_stay_id: roomStayId,
                    room_number: roomNumber,
                    responses,
                    guest_feedback: guestFeedback || null,
                }),
            });

            if (response.ok) {
                setIsSubmitted(true);
                setTimeout(() => {
                    setSelectedSurvey(null);
                    setResponses({});
                    setGuestFeedback('');
                    setIsSubmitted(false);
                }, 3000);
            }
        } catch (error) {
            console.error('Error submitting survey:', error);
        } finally {
            setIsSubmitting(false);
        }
    }

    function renderQuestion(question: any, index: number) {
        const questionId = `q_${index}`;

        switch (question.type) {
            case 'rating':
                return (
                    <div key={index} className="mb-6">
                        <label className="block text-white font-medium mb-3">
                            {question.question}
                            {question.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                    key={rating}
                                    type="button"
                                    onClick={() =>
                                        setResponses((prev) => ({ ...prev, [questionId]: rating }))
                                    }
                                    className="group"
                                >
                                    <Star
                                        className={`w-10 h-10 transition-all ${responses[questionId] >= rating
                                            ? 'text-yellow-400 fill-yellow-400'
                                            : 'text-white/30 hover:text-yellow-300'
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                        {responses[questionId] && (
                            <p className="text-yellow-400 text-sm mt-2">
                                {responses[questionId]} estrellas
                            </p>
                        )}
                    </div>
                );

            case 'text':
                return (
                    <div key={index} className="mb-6">
                        <label className="block text-white font-medium mb-3">
                            {question.question}
                            {question.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <textarea
                            value={responses[questionId] || ''}
                            onChange={(e) =>
                                setResponses((prev) => ({ ...prev, [questionId]: e.target.value }))
                            }
                            className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-white placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            rows={3}
                            placeholder="Tu respuesta..."
                        />
                    </div>
                );

            case 'multiple_choice':
                return (
                    <div key={index} className="mb-6">
                        <label className="block text-white font-medium mb-3">
                            {question.question}
                            {question.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <div className="space-y-2">
                            {question.options.map((option: string, optIndex: number) => (
                                <label
                                    key={optIndex}
                                    className="flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-lg p-3 cursor-pointer transition-all"
                                >
                                    <input
                                        type="radio"
                                        name={questionId}
                                        value={option}
                                        checked={responses[questionId] === option}
                                        onChange={(e) =>
                                            setResponses((prev) => ({ ...prev, [questionId]: e.target.value }))
                                        }
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-white">{option}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    }

    if (isSubmitted) {
        return (
            <div className="bg-neutral-900/40 rounded-2xl p-8 border border-white/5 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-full mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Gracias por tu opinión</h3>
                <p className="text-neutral-400 text-sm">Tu feedback es invaluable para nosotros.</p>
            </div>
        );
    }

    if (!selectedSurvey) {
        return (
            <div>
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Tu opinión cuenta</h2>
                    <p className="text-neutral-400 text-sm">Ayúdanos a mejorar nuestros servicios</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {surveys.map((survey) => (
                        <div
                            key={survey.id}
                            className="group bg-neutral-900/40 backdrop-blur-sm rounded-2xl p-6 border border-white/5 hover:border-brand-red/30 transition-all duration-300"
                        >
                            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-brand-red transition-colors">{survey.title}</h3>
                            <p className="text-neutral-400 text-sm mb-6 line-clamp-2">{survey.description}</p>
                            <button
                                onClick={() => setSelectedSurvey(survey)}
                                className="w-full bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 font-medium py-2.5 px-4 rounded-xl transition-all text-sm flex items-center justify-center gap-2 group-hover:bg-brand-red group-hover:text-white"
                            >
                                Completar Encuesta
                                <span className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">→</span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Survey Form
    const questions = Array.isArray(selectedSurvey.questions)
        ? selectedSurvey.questions
        : [];

    return (
        <div className="bg-neutral-900/40 rounded-2xl p-8 border border-white/5">
            <button
                onClick={() => setSelectedSurvey(null)}
                className="text-neutral-500 hover:text-white mb-6 transition-colors flex items-center gap-2 text-sm"
            >
                <span>←</span> Volver
            </button>

            <h2 className="text-2xl font-bold text-white mb-2">{selectedSurvey.title}</h2>
            <p className="text-neutral-400 text-sm mb-8">{selectedSurvey.description}</p>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                {questions.map((question, index) => renderQuestion(question, index))}

                {/* Additional Feedback */}
                <div className="mb-6">
                    <label className="block text-white font-medium mb-3 text-sm">
                        Comentarios adicionales
                    </label>
                    <textarea
                        value={guestFeedback}
                        onChange={(e) => setGuestFeedback(e.target.value)}
                        className="w-full bg-neutral-950/50 border border-white/10 rounded-xl p-4 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-brand-red/50 focus:ring-1 focus:ring-brand-red/50 transition-all"
                        rows={4}
                        placeholder="Comparte tu experiencia..."
                    />
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-brand-red hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-8 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-red/20 text-sm"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Enviando...</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                <span>Enviar Respuestas</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
