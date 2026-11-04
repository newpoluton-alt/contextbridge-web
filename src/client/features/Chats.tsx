import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowUp,
  Check,
  Copy,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, errorMessage, json } from "../api";
import { isLearningContextOrNull, useSessionState } from "../drafts";
import { dateLabel, ErrorNotice, Spinner } from "../components/ui";
import type { Chat, Encounter, LearningContext } from "../types";

export default function Chats({
  draftKey,
  chats,
  items,
  context,
  clearContext,
  onUpdate,
}: {
  draftKey: string;
  chats: Chat[];
  items: Encounter[];
  context: LearningContext | null;
  clearContext: () => void;
  onUpdate: () => Promise<void>;
}) {
  const [activeId, setActiveId] = useSessionState(`${draftKey}:active`, "");
  const [active, setActive] = useState<Chat | null>(
    () => chats.find((chat) => chat.id === activeId) || null,
  );
  const [draftContext, setDraftContext] =
    useSessionState<LearningContext | null>(
      `${draftKey}:contextData`,
      null,
      isLearningContextOrNull,
    );
  const [messageDrafts, setMessageDrafts] = useSessionState<
    Record<string, string>
  >(
    `${draftKey}:messages`,
    {},
    (value): value is Record<string, string> =>
      !!value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.values(value).every((item) => typeof item === "string"),
  );
  const pendingContext = context || draftContext;
  const messageKey =
    active?.id ||
    pendingContext?.id ||
    (pendingContext
      ? `context:${pendingContext.language}:${pendingContext.expression}:${pendingContext.sentence}`
      : "new");
  const draft = messageDrafts[messageKey] || "";
  function setDraft(value: string) {
    setMessageDrafts((current) => ({ ...current, [messageKey]: value }));
  }
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const selectionVersion = useRef(0);
  useEffect(() => {
    if (context) {
      setActive(null);
      setActiveId("");
      setDraftContext(context);
    }
  }, [context]);
  useEffect(() => {
    if (active) setActiveId(active.id);
  }, [active?.id]);
  useEffect(() => {
    if (!active || busy) return;
    const latest = chats.find((chat) => chat.id === active.id);
    if (latest && latest.updatedAt !== active.updatedAt) setActive(latest);
    if (!latest) {
      setActive(null);
      setActiveId("");
    }
  }, [chats]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages.length]);
  async function select(chat: Chat) {
    if (busy) return;
    const version = ++selectionVersion.current;
    setLoading(true);
    setError("");
    clearContext();
    setDraftContext(null);
    try {
      const loaded = await api<Chat>(`/chats/${chat.id}`);
      if (version === selectionVersion.current) setActive(loaded);
    } catch (e) {
      if (version === selectionVersion.current) setError(errorMessage(e));
    } finally {
      if (version === selectionVersion.current) setLoading(false);
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await api<Chat>(
        active ? `/chats/${active.id}/messages` : "/chats",
        json({
          message: draft.trim(),
          ...(pendingContext && !active
            ? pendingContext.id
              ? { encounterId: pendingContext.id }
              : { context: pendingContext }
            : {}),
        }),
      );
      setActive(next);
      setDraft("");
      clearContext();
      setDraftContext(null);
      await onUpdate();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function remove(chat: Chat) {
    if (!window.confirm(`Delete “${chat.title}” and its messages?`)) return;
    setError("");
    try {
      await api(`/chats/${chat.id}`, { method: "DELETE" });
      if (active?.id === chat.id) {
        setActive(null);
        setActiveId("");
      }
      await onUpdate();
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError(
        "Copy is unavailable in this browser. You can select and copy the message text.",
      );
    }
  }
  const encounter = active
    ? items.find((x) => x.id === active.encounterId) || active.context
    : pendingContext;
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">THERE’S ALWAYS ANOTHER QUESTION</span>
          <h1>
            Think it through<span className="heading-period">.</span>
          </h1>
          <p>A little grammar, another example, a different point of view.</p>
        </div>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            selectionVersion.current += 1;
            setLoading(false);
            setActive(null);
            setActiveId("");
            setDraftContext(null);
            clearContext();
            setMessageDrafts((current) => ({ ...current, new: "" }));
            setError("");
          }}
        >
          <Plus size={17} />
          New conversation
        </button>
      </div>
      <div className="chat-layout">
        <aside className="chat-history">
          <span className="eyebrow">YOUR CONVERSATIONS</span>
          {chats.length ? (
            [...chats]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((chat) => (
                <div
                  className={`history-row ${active?.id === chat.id ? "active" : ""}`}
                  key={chat.id}
                >
                  <button disabled={busy} onClick={() => select(chat)}>
                    <MessageCircle size={16} />
                    <span>
                      <strong>{chat.title}</strong>
                      <small>{dateLabel(chat.updatedAt)}</small>
                    </span>
                  </button>
                  <button
                    className="icon-button history-delete"
                    disabled={busy}
                    onClick={() => remove(chat)}
                    aria-label={`Delete ${chat.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
          ) : (
            <p className="history-empty">
              Your saved conversations will appear here. Start with something
              you’re curious about.
            </p>
          )}
          <div className="chat-history-note">
            <Sparkles size={16} />
            <p>
              Follow the grammar and the context. Keep the original reading
              yours.
            </p>
          </div>
        </aside>
        <section className="chat-panel">
          <header className="chat-header">
            <span className="assistant-avatar">
              <Sparkles size={18} />
            </span>
            <div>
              <h3>{active?.title || "Your context companion"}</h3>
              <span>Focused help. Room for your own thinking.</span>
            </div>
          </header>
          {encounter && (
            <div className="chat-context">
              <span className="eyebrow">
                EXPLORING “{encounter.expression}”
              </span>
              <p>{encounter.sentence}</p>
              {!active && (
                <button
                  className="icon-button"
                  onClick={() => {
                    clearContext();
                    setDraftContext(null);
                  }}
                  aria-label="Remove selected context"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          )}
          {error && (
            <ErrorNotice message={error} onClose={() => setError("")} />
          )}
          <div className="chat-messages" aria-live="polite">
            {loading ? (
              <Spinner label="Opening your conversation…" />
            ) : active?.messages.length ? (
              active.messages.map((message) => (
                <article
                  key={message.id}
                  className={`chat-message ${message.role}`}
                >
                  <div className="message-byline">
                    <span>
                      {message.role === "assistant" ? (
                        <>
                          <Sparkles size={14} />
                          ContextBridge
                        </>
                      ) : (
                        "You"
                      )}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Copy message"
                      onClick={() => copy(message.id, message.content)}
                    >
                      {copied === message.id ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  <div className="markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        pre: ({ children }) => (
                          <CopyableCode>{children}</CopyableCode>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </article>
              ))
            ) : (
              <div className="chat-welcome">
                <div className="chat-welcome-symbol">✳</div>
                <span className="eyebrow">LET’S FOLLOW THE CONTEXT</span>
                <h2>What makes you curious?</h2>
                <p>
                  Ask about a word’s role, a grammatical pattern,
                  <br />
                  or how a meaning changes from sentence to sentence.
                </p>
                <div className="suggestion-chips">
                  {(encounter
                    ? [
                        `What role does “${encounter.expression}” play here?`,
                        "Can you give me a similar example?",
                        "What contextual clue should I notice?",
                      ]
                    : [
                        "How can I use context to understand a new expression?",
                        "How do I recognize a phrasal verb?",
                        "Give me an example of the same word with two meanings.",
                      ]
                  ).map((text) => (
                    <button key={text} onClick={() => setDraft(text)}>
                      {text}
                      <ArrowUp size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {busy && (
              <div className="assistant-thinking">
                <span />
                <span />
                <span />
                Looking at the context…
              </div>
            )}
            <div ref={end} />
          </div>
          <form className="chat-composer" onSubmit={send}>
            <label className="sr-only" htmlFor="chat-message">
              Your message
            </label>
            <textarea
              id="chat-message"
              rows={2}
              maxLength={3000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask a question, share an interpretation…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim() && !busy)
                    e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              className="send-button"
              disabled={!draft.trim() || busy || loading}
              aria-label="Send message"
            >
              <ArrowUp size={20} />
            </button>
          </form>
          <p className="chat-disclaimer">
            AI can make mistakes. Ask for clarification and compare with the
            original sentence.
          </p>
        </section>
      </div>
    </div>
  );
}

function CopyableCode({ children }: { children: ReactNode }) {
  const code = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code.current?.textContent || "");
      setCopied(true);
      setError("");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Select the code below to copy it manually.");
    }
  }
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>Code</span>
        <button type="button" className="text-link" onClick={copy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre ref={code}>{children}</pre>
      {error && (
        <p className="small" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
