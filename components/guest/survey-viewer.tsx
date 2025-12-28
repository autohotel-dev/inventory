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
            <div className="bg-gradient-to-br from-green-950/50 to-blue-950/50 rounded-2xl p-8 border border-green-500/20 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-4">
                    <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">¡Gracias por tu opinión!</h3>
                <p className="text-white/70">Tu feedback nos ayuda a mejorar cada día.</p>
            </div>
        );
    }

    if (!selectedSurvey) {
        return (
            <div>
                <div className="mb-6">
                    <h2 className="text-3xl font-bold text-white mb-2">Encuestas</h2>
                    <p className="text-blue-300">Tu opinión es importante para nosotros</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {surveys.map((survey) => (
                        <div
                            key={survey.id}
                            className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-blue-500/50 transition-all"
                        >
                            <h3 className="text-xl font-bold text-white mb-2">{survey.title}</h3>
                            <p className="text-white/60 text-sm mb-4">{survey.description}</p>
                            <button
                                onClick={() => setSelectedSurvey(survey)}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-all w-full"
                            >
                                Completar Encuesta
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
        <div className="bg-gradient-to-br from-indigo-950/50 to-purple-950/50 rounded-2xl p-8 border border-indigo-500/20">
            <button
                onClick={() => setSelectedSurvey(null)}
                className="text-white/60 hover:text-white mb-6 transition-colors"
            >
                ← Volver a encuestas
            </button>

            <h2 className="text-3xl font-bold text-white mb-2">{selectedSurvey.title}</h2>
            <p className="text-white/70 mb-8">{selectedSurvey.description}</p>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                {questions.map((question, index) => renderQuestion(question, index))}

                {/* Additional Feedback */}
                <div className="mb-6">
                    <label className="block text-white font-medium mb-3">
                        Comentarios adicionales (opcional)
                    </label>
                    <textarea
                        value={guestFeedback}
                        onChange={(e) => setGuestFeedback(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-white placeholder-white/40 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                        rows={4}
                        placeholder="Cuéntanos más sobre tu experiencia..."
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                    {isSubmitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Enviando...</span>
                        </>
                    ) : (
                        <>
                            <Send className="w-5 h-5" />
                            <span>Enviar Encuesta</span>
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
