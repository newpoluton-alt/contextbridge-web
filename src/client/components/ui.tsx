import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  LoaderCircle,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Encounter, Explanation } from "../types";

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <BookOpen size={23} strokeWidth={1.8} />
      </span>
      <span>
        context<span className="brand-light">bridge</span>
        <small>WORDS WITH A WORLD</small>
      </span>
    </div>
  );
}
export function Spinner({ label = "Loading your space…" }: { label?: string }) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} />
      <span>{label}</span>
    </div>
  );
}
export function ErrorNotice({
  message,
  onClose,
}: {
  message: string;
  onClose?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
      {onClose && (
        <button
          className="icon-button"
          aria-label="Dismiss error"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function LanguageTag({ language }: { language: string }) {
  return (
    <span className="language-tag">
      <span />
      {language}
    </span>
  );
}
export function statusLabel(item: Encounter) {
  return item.unresolved
    ? "Still exploring"
    : item.attemptStatus === "not_attempted"
      ? "Not attempted"
      : item.attemptStatus === "assisted"
        ? "Practiced with help"
        : "Interpretation attempted";
}
export function dateLabel(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
export function safeSource(url: string) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function SourceLink({ url }: { url: string }) {
  const safe = safeSource(url);
  if (!safe) return null;
  return (
    <a className="text-link" href={safe} target="_blank" rel="noreferrer">
      Original source <ArrowUpRight size={14} />
    </a>
  );
}
export function ExplanationView({
  explanation: e,
}: {
  explanation: Explanation;
}) {
  return (
    <div className="explanation">
      <div>
        <span className="eyebrow">IN THIS CONTEXT</span>
        <h3>{e.meaning}</h3>
        {e.translation && <p className="translation">{e.translation}</p>}
      </div>
      {e.evidence && (
        <section>
          <h4>What the sentence tells us</h4>
          <p>{e.evidence}</p>
        </section>
      )}
      {e.grammar && (
        <section>
          <h4>A little grammar</h4>
          <p>{e.grammar}</p>
        </section>
      )}
      {e.example && (
        <section className="example-block">
          <h4>Another way to see it</h4>
          <p>“{e.example}”</p>
        </section>
      )}
      {e.alternatives?.length > 0 && (
        <section>
          <h4>Other possible readings</h4>
          <ul>
            {e.alternatives.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
