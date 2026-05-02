"use client";

import { useState } from "react";
import { Star, Send, Loader2, CheckCircle } from "lucide-react";

interface FeedbackFormProps {
  roomNumber: string;
  stayId: string;
}

const categories = [
  { key: "cleanliness", label: "Limpieza", emoji: "🧹" },
  { key: "service", label: "Servicio", emoji: "🛎️" },
  { key: "comfort", label: "Comodidad", emoji: "🛏️" },
  { key: "amenities", label: "Amenidades", emoji: "🧴" },
  { key: "value", label: "Relación Precio", emoji: "💰" },
];

export function FeedbackForm({ roomNumber, stayId }: FeedbackFormProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [hovering, setHovering] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const setRating = (category: string, value: number) => {
    setRatings((prev) => ({ ...prev, [category]: value }));
  };

  const avgRating =
    Object.values(ratings).length > 0
      ? (Object.values(ratings).reduce((a, b) => a + b, 0) / Object.values(ratings).length).toFixed(1)
      : "0.0";

  const handleSubmit = async () => {
    if (Object.keys(ratings).length === 0) return;
    setSubmitting(true);

    try {
      await fetch("/api/guest/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_number: roomNumber,
          stay_id: stayId,
          ratings,
          comment,
          average_rating: parseFloat(avgRating),
        }),
      });
      setSubmitted(true);
    } catch {
      // Silent fail
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-6">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">¡Gracias por tu opinión!</h3>
        <p className="text-white/60 text-sm max-w-sm mx-auto">
          Tu retroalimentación nos ayuda a mejorar. Esperamos verte pronto de nuevo.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/10">
          <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
          <span className="text-white font-bold text-lg">{avgRating}</span>
          <span className="text-white/50 text-sm">/ 5.0</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">¿Cómo fue tu experiencia?</h2>
        <p className="text-white/60 text-sm">Tu opinión es muy valiosa para nosotros</p>
      </div>

      <div className="space-y-4 mb-6">
        {categories.map((cat) => {
          const rating = ratings[cat.key] || 0;
          const hover = hovering[cat.key] || 0;
          const display = hover || rating;

          return (
            <div
              key={cat.key}
              className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cat.emoji}</span>
                  <span className="text-white font-medium text-sm">{cat.label}</span>
                </div>
                {rating > 0 && (
                  <span className="text-amber-400 text-xs font-semibold">{rating}/5</span>
                )}
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => setRating(cat.key, v)}
                    onMouseEnter={() => setHovering((p) => ({ ...p, [cat.key]: v }))}
                    onMouseLeave={() => setHovering((p) => ({ ...p, [cat.key]: 0 }))}
                    className="p-1 transition-transform hover:scale-125 active:scale-90"
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        v <= display
                          ? "text-amber-400 fill-amber-400"
                          : "text-white/20"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Comment */}
      <div className="mb-6">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Cuéntanos más sobre tu experiencia... (opcional)"
          rows={3}
          className="w-full bg-neutral-900/50 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 resize-none text-sm"
        />
      </div>

      {/* Summary + Submit */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-sm">Promedio:</span>
          <div className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span className="text-amber-400 font-bold">{avgRating}</span>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={Object.keys(ratings).length === 0 || submitting}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/20"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          Enviar Opinión
        </button>
      </div>
    </div>
  );
}
