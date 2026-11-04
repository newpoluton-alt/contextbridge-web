import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  Layers3,
  LoaderCircle,
  RotateCcw,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { api, errorMessage, json } from "../api";
import {
  Empty,
  ErrorNotice,
  ExplanationView,
  LanguageTag,
} from "../components/ui";
import type { Encounter } from "../types";

export default function Review({
  items,
  onUpdate,
  onExplore,
}: {
  items: Encounter[];
  onUpdate: () => Promise<void>;
  onExplore: () => void;
}) {
  const [queue] = useState(() =>
    items
      .filter((x) => new Date(x.review.dueAt).getTime() <= Date.now())
      .sort((a, b) => a.review.dueAt.localeCompare(b.review.dueAt)),
  );
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState("");
  const [hint, setHint] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [assistance, setAssistance] = useState<string[]>([]);
  const [unresolved, setUnresolved] = useState(false);
  const item = queue[index];
  useEffect(() => {
    setUnresolved(item?.unresolved ?? false);
    setAssistance([]);
  }, [item?.id]);
  function mark(step: string) {
    setAssistance((current) =>
      current.includes(step) ? current : [...current, step],
    );
  }
  const progress = queue.length ? Math.round((index / queue.length) * 100) : 0;
  async function rate(rating: "again" | "hard" | "good" | "easy") {
    if (!item) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/encounters/${item.id}/review`,
        json({ rating, interpretation: attempt, assistance, unresolved }),
      );
      await onUpdate();
      setIndex((i) => i + 1);
      setCompleted((x) => x + 1);
      setRevealed(false);
      setAttempt("");
      setHint(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function skip() {
    setIndex((i) => i + 1);
    setRevealed(false);
    setAttempt("");
    setHint(false);
  }
  async function keepUncertainty() {
    if (!item) return;
    setBusy(true);
    setError("");
    try {
      await api(`/encounters/${item.id}`, json({ unresolved: true }, "PATCH"));
      await onUpdate();
      skip();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !item ||
      !window.confirm(`Delete the saved encounter for “${item.expression}”?`)
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`/encounters/${item.id}`, { method: "DELETE" });
      await onUpdate();
      skip();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MEET YOUR WORDS AGAIN</span>
          <h1>
            A little return. A deeper connection
            <span className="heading-period">.</span>
          </h1>
          <p>
            Begin with the sentence. Let your own interpretation come first.
          </p>
        </div>
      </div>
      {error && <ErrorNotice message={error} />}
      {item ? (
        <div className="review-container">
          <div className="review-progress">
            <span>
              {index + 1} of {queue.length} encounters
            </span>
            <span>{completed} reviewed</span>
          </div>
          <div className="progress-track">
            <div style={{ width: `${progress}%` }} />
          </div>
          <section className="review-card">
            <div className="review-card-top">
              <LanguageTag language={item.language} />
              <span className="small muted">
                {item.review.repetitions
                  ? `${item.review.repetitions} previous reviews`
                  : "First review"}
              </span>
            </div>
            <span className="eyebrow">
              WHAT DOES THIS EXPRESSION MEAN HERE?
            </span>
            <h2>{item.expression}</h2>
            <blockquote>{item.sentence}</blockquote>
            {!revealed ? (
              <div className="review-prompt">
                {hint && (
                  <div className="hint-box">
                    <p>{item.explanation.clue}</p>
                  </div>
                )}
                <label>
                  Your interpretation (optional)
                  <textarea
                    value={attempt}
                    onChange={(e) => {
                      setAttempt(e.target.value);
                      if (e.target.value.trim()) mark("review_attempt");
                    }}
                    rows={2}
                    placeholder="Recall the meaning before you reveal it…"
                    maxLength={1500}
                  />
                </label>
                <div className="button-row">
                  <button
                    className="button primary"
                    onClick={() => {
                      setRevealed(true);
                      mark("review_reveal");
                    }}
                  >
                    <Eye size={17} />
                    Reveal explanation
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setHint(true);
                      mark("review_clue");
                    }}
                  >
                    Request a clue
                  </button>
                </div>
              </div>
            ) : (
              <div className="review-answer">
                {attempt && (
                  <div className="first-interpretation">
                    <span className="eyebrow">YOUR RECALL</span>
                    <p>{attempt}</p>
                  </div>
                )}
                <ExplanationView explanation={item.explanation} />
                <label className="checkbox-label review-uncertainty">
                  <input
                    type="checkbox"
                    checked={unresolved}
                    onChange={(e) => setUnresolved(e.target.checked)}
                  />
                  I’m still uncertain about this explanation.
                </label>
                <div className="review-rating">
                  <h4>How did recalling it feel?</h4>
                  <p>
                    {hint
                      ? "You used a clue. Choose the rating that fits your experience."
                      : "Your rating sets the next review date. It isn’t a test score."}
                  </p>
                  <div className="rating-buttons">
                    {[
                      {
                        rating: "again",
                        label: "Again",
                        note: "10 minutes",
                        icon: <RotateCcw size={16} />,
                      },
                      {
                        rating: "hard",
                        label: "Hard",
                        note: "More practice",
                        icon: null,
                      },
                      {
                        rating: "good",
                        label: "Good",
                        note: "A little later",
                        icon: null,
                      },
                      {
                        rating: "easy",
                        label: "Easy",
                        note: "Further ahead",
                        icon: <Check size={16} />,
                      },
                    ].map((x) => (
                      <button
                        disabled={busy}
                        key={x.rating}
                        className={`rating-button ${x.rating}`}
                        onClick={() =>
                          rate(x.rating as "again" | "hard" | "good" | "easy")
                        }
                      >
                        <strong>
                          {x.icon}
                          {x.label}
                        </strong>
                        <small>{x.note}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="review-controls">
              <button
                className="text-link"
                disabled={busy}
                onClick={keepUncertainty}
              >
                <HelpCircle size={15} />
                Keep unresolved and move on
              </button>
              <button
                className="text-link danger-link"
                disabled={busy}
                onClick={remove}
              >
                <Trash2 size={14} />
                Delete this encounter
              </button>
            </div>
          </section>
          <div className="review-bottom">
            <span>Go at your own pace. Uncertainty is part of learning.</span>
            <button className="text-link" onClick={skip} disabled={busy}>
              Skip for now <ArrowRight size={15} />
            </button>
          </div>
        </div>
      ) : (
        <div className="card review-complete">
          <Empty
            icon={<Layers3 size={30} />}
            title={
              queue.length
                ? "A little practice, well spent."
                : "You’re all caught up."
            }
            text={
              queue.length
                ? `You reviewed ${completed} ${completed === 1 ? "encounter" : "encounters"}. Skipped items remain available for another visit.`
                : items.length
                  ? "No cards are due right now. Come back later, or discover a new word."
                  : "Save your first encounter to begin practicing with review cards."
            }
            action={
              <button className="button primary" onClick={onExplore}>
                Explore another word
                <ArrowRight size={17} />
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
