import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  Globe2,
  Home,
  Layers3,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Puzzle,
  Search,
  Settings2,
  Sparkles,
  Sprout,
  X,
} from "lucide-react";
import { api, downloadAnki, errorMessage, json, setTokenProvider } from "./api";
import { createClient, type AuthClient } from "./auth";
import { clearAccountDrafts } from "./drafts";
import {
  Brand,
  dateLabel,
  Empty,
  ErrorNotice,
  ExplanationView,
  LanguageTag,
  SourceLink,
  Spinner,
  statusLabel,
} from "./components/ui";
import AuthScreen from "./features/AuthScreen";
import Learn from "./features/Learn";
import Review from "./features/Review";
import Chats from "./features/Chats";
import Preferences from "./features/Preferences";
import type {
  Chat,
  Config,
  Encounter,
  LearningContext,
  Page,
  Settings,
} from "./types";

const pageLabels: Record<Page, string> = {
  overview: "Overview",
  library: "My word library",
  learn: "Explore a word",
  review: "Daily review",
  chats: "Learning conversations",
  settings: "Settings",
};
const navigation = [
  { page: "overview", icon: Home, label: "Overview" },
  { page: "library", icon: BookOpen, label: "Word library" },
  { page: "learn", icon: Sparkles, label: "Explore a word" },
  { page: "review", icon: Layers3, label: "Review cards" },
  { page: "chats", icon: MessageCircle, label: "Conversations" },
] as const;
function pageFromHash(): Page {
  const hash = window.location.hash.slice(1) as Page;
  return hash in pageLabels ? hash : "overview";
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [auth, setAuth] = useState<AuthClient | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [booting, setBooting] = useState(true);
  const [items, setItems] = useState<Encounter[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Encounter | null>(null);
  const [chatContext, setChatContext] = useState<LearningContext | null>(null);
  const [accountId, setAccountId] = useState("");
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const sessionVersion = useRef(0);
  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const version = sessionVersion.current;
    const request = (async () => {
      const [words, preferences, conversations, identity] = await Promise.all([
        api<{ items: Encounter[] }>("/encounters"),
        api<Settings>("/settings"),
        api<{ items: Chat[] }>("/chats"),
        api<{ id: string }>("/me"),
      ]);
      if (sessionVersion.current !== version) return;
      setItems(words.items);
      setSettings(preferences);
      setChats(conversations.items);
      setAccountId(identity.id);
    })();
    refreshInFlight.current = request;
    try {
      await request;
    } finally {
      if (refreshInFlight.current === request) refreshInFlight.current = null;
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const c = await api<Config>("/config");
        if (cancelled) return;
        setConfig(c);
        if (c.demo) {
          setTokenProvider(undefined);
          setSignedIn(true);
          await refresh();
        } else if (c.authUrl) {
          const client = createClient(c.authUrl);
          // Neon exposes a callable Proxy. Wrap it so React stores the client
          // instead of treating it as an updater and requesting the auth root.
          setAuth(() => client);
          setTokenProvider(async () => {
            const result = await client.token();
            if (result.error || !result.data?.token) {
              sessionVersion.current += 1;
              refreshInFlight.current = null;
              setSignedIn(false);
              setItems([]);
              setSettings(null);
              setChats([]);
              throw new Error("Your session expired. Please sign in again.");
            }
            return result.data.token;
          });
          const session = await client.getSession();
          if (session.data?.user) {
            if (!session.data.user.emailVerified) {
              setVerificationEmail(session.data.user.email);
            } else {
              setSignedIn(true);
              await refresh();
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  useEffect(() => {
    const change = () => {
      setPage(pageFromHash());
      setMenu(false);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    let lastRefresh = 0;
    const sync = () => {
      if (
        document.visibilityState !== "visible" ||
        Date.now() - lastRefresh < 1500
      )
        return;
      lastRefresh = Date.now();
      void refresh().catch((e) => setError(errorMessage(e)));
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [signedIn, refresh]);
  function navigate(p: Page) {
    window.location.hash = p;
    setPage(p);
    setMenu(false);
  }
  async function onSignedIn() {
    if (!auth) return;
    const session = await auth.getSession();
    if (session.data?.user) {
      if (!session.data.user.emailVerified) {
        setVerificationEmail(session.data.user.email);
        return;
      }
      setVerificationEmail("");
      setSignedIn(true);
      await refresh();
    }
  }
  async function signOut() {
    try {
      const result = await auth?.signOut();
      if (result?.error)
        throw new Error(result.error.message || "Could not sign out.");
      clearAccountDrafts(accountId);
      sessionVersion.current += 1;
      refreshInFlight.current = null;
      setSignedIn(false);
      setItems([]);
      setSettings(null);
      setChats([]);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const due = items.filter(
    (x) => new Date(x.review.dueAt).getTime() <= Date.now(),
  );
  async function exportWords() {
    try {
      await downloadAnki();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function startChat(item: LearningContext) {
    setChatContext(item);
    setSelected(null);
    navigate("chats");
  }
  if (booting)
    return (
      <div className="startup">
        <Brand />
        <Spinner />
      </div>
    );
  if (!config)
    return (
      <div className="startup">
        <Brand />
        <ErrorNotice message={error || "Could not connect to the server."} />
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  if (!signedIn)
    return (
      <AuthScreen
        client={auth}
        onSignedIn={onSignedIn}
        verificationEmail={verificationEmail}
      />
    );
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Brand />
        <div className="sidebar-label">YOUR LEARNING SPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ page: p, icon: Icon, label }) => (
            <button
              key={p}
              className={`nav-item ${page === p ? "active" : ""}`}
              onClick={() => navigate(p)}
              aria-current={page === p ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {p === "review" && due.length > 0 && (
                <span className="nav-count">{due.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="extension-card">
            <span className="extension-icon">
              <Puzzle size={23} />
            </span>
            <h4>
              Take your curiosity
              <br />
              with you.
            </h4>
            <p>Learn from any page with the browser extension.</p>
            <button className="text-link" onClick={() => navigate("settings")}>
              Connect extension <ArrowUpRight size={15} />
            </button>
          </div>
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={19} />
            <span>Settings</span>
          </button>
          {!config.demo && (
            <button className="nav-item" onClick={signOut}>
              <LogOut size={19} />
              <span>Sign out</span>
            </button>
          )}
          <div className="sidebar-footer">
            <span className="status-dot" />
            {config.demo
              ? "Local demo workspace"
              : "Your private learning space"}
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span className="topbar-home">My workspace</span>
            <ChevronRight size={13} />
            <strong>{pageLabels[page]}</strong>
          </div>
          <div className="topbar-right">
            {config.demo && <span className="demo-pill">Demo mode</span>}
            <span className="topbar-language">
              <Globe2 size={15} />
              {settings?.learningLanguage || "English"}
            </span>
            <button
              className="avatar"
              aria-label="Open profile settings"
              onClick={() => navigate("settings")}
            >
              {settings?.name?.slice(0, 1).toUpperCase() || "Y"}
            </button>
          </div>
        </header>
        <main className="main-content">
          {error && (
            <ErrorNotice message={error} onClose={() => setError("")} />
          )}
          {!settings ? (
            <div className="card">
              <p>Your learning space could not be loaded.</p>
              <button
                className="button primary"
                onClick={() =>
                  refresh().catch((e) => setError(errorMessage(e)))
                }
              >
                Reload workspace
              </button>
            </div>
          ) : (
            <>
              {page === "overview" && (
                <Overview
                  items={items}
                  settings={settings}
                  config={config}
                  navigate={navigate}
                  onSelect={setSelected}
                />
              )}
              {page === "library" && (
                <Library
                  items={items}
                  onSelect={setSelected}
                  onExplore={() => navigate("learn")}
                  onExport={exportWords}
                />
              )}
              {page === "learn" && (
                <Learn
                  draftKey={`contextbridge:${accountId}:learn`}
                  items={items}
                  settings={settings}
                  config={config}
                  onSaved={refresh}
                  onChat={startChat}
                />
              )}
              {page === "review" && (
                <Review
                  items={items}
                  onUpdate={refresh}
                  onExplore={() => navigate("learn")}
                />
              )}
              {page === "chats" && (
                <Chats
                  draftKey={`contextbridge:${accountId}:chat`}
                  chats={chats}
                  items={items}
                  context={chatContext}
                  clearContext={() => setChatContext(null)}
                  onUpdate={refresh}
                />
              )}
              {page === "settings" && (
                <Preferences
                  settings={settings}
                  config={config}
                  onUpdate={refresh}
                  onExport={exportWords}
                />
              )}
            </>
          )}
        </main>
        <footer className="page-footer">
          <span>Small discoveries. Lasting connections.</span>
          <span>
            ContextBridge <span className="footer-dot">·</span> Learn in context
          </span>
        </footer>
      </div>
      {selected && (
        <EncounterDialog
          item={selected}
          onClose={() => setSelected(null)}
          onDelete={async () => {
            await api(`/encounters/${selected.id}`, { method: "DELETE" });
            setSelected(null);
            await refresh();
          }}
          onChat={() => startChat(selected)}
          onUpdate={async (item) => {
            setSelected(item);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function Overview({
  items,
  settings,
  config,
  navigate,
  onSelect,
}: {
  items: Encounter[];
  settings: Settings;
  config: Config;
  navigate: (page: Page) => void;
  onSelect: (item: Encounter) => void;
}) {
  const due = items.filter(
    (x) => new Date(x.review.dueAt).getTime() <= Date.now(),
  ).length;
  const languages = [...new Set(items.map((x) => x.language))];
  const practiced = items.filter((x) => x.review.repetitions > 0).length;
  const today = items.filter(
    (x) => new Date(x.createdAt).toDateString() === new Date().toDateString(),
  ).length;
  const recent = [...items]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  const parts = Object.entries(
    items.reduce<Record<string, number>>((sum, item) => {
      const part = item.explanation.partOfSpeech || "Other";
      sum[part] = (sum[part] || 0) + 1;
      return sum;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE EVERY DAY GOES A LONG WAY</span>
          <h1>
            Hello, {settings.name?.split(" ")[0] || "curious mind"}
            <span className="heading-period">.</span>
          </h1>
          <p>Welcome to the home of your growing vocabulary.</p>
        </div>
        <button className="button secondary" onClick={() => navigate("learn")}>
          <Plus size={17} />
          Explore a word
        </button>
      </div>
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span />
            YOUR NEXT SMALL DISCOVERY
          </span>
          <h2>
            Make every word
            <br />
            part of <em>your world.</em>
          </h2>
          <p>
            A word is more than a translation. Revisit the sentences,
            <br className="desktop-break" /> stories, and little moments that
            made it yours.
          </p>
          <button
            className="button dark"
            onClick={() => navigate(due ? "review" : "learn")}
          >
            {due ? "Start your daily review" : "Find your next word"}
            <ArrowRight size={18} />
          </button>
          <span className="hero-note">
            {due
              ? `${due} ${due === 1 ? "encounter is" : "encounters are"} ready to revisit`
              : "Follow a word that makes you curious"}
          </span>
        </div>
        <div className="word-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="art-spark spark-one">✳</span>
          <span className="art-spark spark-two">✦</span>
          <div className="floating-word word-one">
            <small>DEUTSCH</small>entdecken<span>to discover</span>
          </div>
          <div className="floating-word word-two">
            <small>ENGLISH</small>serendipity<span>a happy discovery</span>
          </div>
          <div className="floating-word word-three">
            <small>FRANÇAIS</small>un monde<span>a world</span>
          </div>
          <div className="art-dot" />
        </div>
      </section>
      <section className="stats-grid" aria-label="Your learning statistics">
        {[
          {
            icon: BookOpen,
            label: "Saved encounters",
            value: items.length,
            note: `${today} added today`,
            color: "green",
          },
          {
            icon: Layers3,
            label: "Ready to revisit",
            value: due,
            note: "A fresh chance to remember",
            color: "peach",
          },
          {
            icon: Globe2,
            label: "Languages explored",
            value: languages.length,
            note: languages.length
              ? languages.join(" · ")
              : "Start with one expression",
            color: "purple",
          },
          {
            icon: Sprout,
            label: "Cards practiced",
            value: practiced,
            note: "Every return is progress",
            color: "blue",
          },
        ].map(({ icon: Icon, label, value, note, color }) => (
          <article className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={`stat-icon ${color}`}>
                <Icon size={18} />
              </span>
            </div>
            <strong>{value}</strong>
            <p>{note}</p>
          </article>
        ))}
      </section>
      <div className="overview-bottom">
        <section className="card recent-card">
          <div className="section-heading">
            <div>
              <h2>Fresh from your reading</h2>
              <p>The words you’ve been collecting.</p>
            </div>
            <button className="text-link" onClick={() => navigate("library")}>
              View library <ArrowRight size={15} />
            </button>
          </div>
          {recent.length ? (
            <div className="recent-list">
              {recent.map((item) => (
                <button
                  key={item.id}
                  className="recent-item"
                  onClick={() => onSelect(item)}
                >
                  <span
                    className={`word-monogram ${item.language === "German" ? "peach" : item.language === "French" ? "purple" : "green"}`}
                  >
                    {item.expression.slice(0, 1)}
                  </span>
                  <span className="recent-word">
                    <strong>{item.expression}</strong>
                    <span>{item.explanation.meaning}</span>
                  </span>
                  <LanguageTag language={item.language} />
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              icon={<BookOpen />}
              title="Your collection starts here"
              text="Save a word in its original sentence and keep the context with it."
              action={
                <button
                  className="button secondary"
                  onClick={() => navigate("learn")}
                >
                  Explore your first word <ArrowRight size={16} />
                </button>
              }
            />
          )}
        </section>
        <aside className="insight-card">
          <span className="eyebrow">YOUR COLLECTION, AT A GLANCE</span>
          <h2>
            A language
            <br />
            takes shape.
          </h2>
          {parts.length ? (
            <div className="part-bars">
              {parts.map(([part, count]) => (
                <div className="part-row" key={part}>
                  <div>
                    <span>{part}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className="bar-track">
                    <div
                      style={{
                        width: `${Math.max(8, (count / items.length) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>Your word types will appear here as your library grows.</p>
          )}
          <div className="insight-note">
            <Sparkles size={18} />
            <p>
              Different contexts can reveal different meanings. Stay curious.
            </p>
          </div>
        </aside>
      </div>
      {config.demo && (
        <p className="demo-caption">
          You’re exploring a local demo. Sample explanations are labeled, and
          saved changes stay on this computer.
        </p>
      )}
    </div>
  );
}

function Library({
  items,
  onSelect,
  onExplore,
  onExport,
}: {
  items: Encounter[];
  onSelect: (item: Encounter) => void;
  onExplore: () => void;
  onExport: () => void;
}) {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("all");
  const [sort, setSort] = useState("recent");
  const filtered = items
    .filter(
      (x) =>
        (language === "all" || x.language === language) &&
        `${x.expression} ${x.sentence} ${x.explanation.meaning}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "alphabetical"
        ? a.expression.localeCompare(b.expression)
        : b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A COLLECTION OF SMALL DISCOVERIES</span>
          <h1>
            Your word library<span className="heading-period">.</span>
          </h1>
          <p>Every expression, with the moment that gave it meaning.</p>
        </div>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={onExport}
            disabled={!items.length}
          >
            <Download size={16} />
            Anki export
          </button>
          <button className="button primary" onClick={onExplore}>
            <Plus size={17} />
            Explore a word
          </button>
        </div>
      </div>
      <div className="library-toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Search your library"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a word, meaning, or sentence…"
          />
          {search && (
            <button
              className="icon-button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <select
          aria-label="Filter by language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="all">All languages</option>
          {[...new Set(items.map((x) => x.language))].sort().map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Sort words"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">Recently added</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
      </div>
      <div className="library-count">
        {filtered.length} {filtered.length === 1 ? "encounter" : "encounters"}
        <span>Saved with context. Ready to revisit.</span>
      </div>
      {filtered.length ? (
        <div className="card library-table">
          <div className="library-table-head">
            <span>WORD / EXPRESSION</span>
            <span>IN CONTEXT</span>
            <span>LANGUAGE</span>
            <span>ADDED</span>
            <span />
          </div>
          {filtered.map((item) => (
            <button
              className="library-row"
              key={item.id}
              onClick={() => onSelect(item)}
            >
              <span className="library-word">
                <strong>{item.expression}</strong>
                <small>
                  {item.explanation.partOfSpeech} <span>·</span>{" "}
                  {statusLabel(item)}
                </small>
              </span>
              <span className="library-context">
                <span>{item.explanation.meaning}</span>
                <small>“{item.sentence}”</small>
              </span>
              <LanguageTag language={item.language} />
              <span className="library-date">{dateLabel(item.createdAt)}</span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      ) : (
        <div className="card">
          <Empty
            icon={<Search />}
            title={
              search || language !== "all"
                ? "No encounters found"
                : "A place for your discoveries"
            }
            text={
              search || language !== "all"
                ? "Try another word or choose a different language."
                : "Explore an expression, then save it here with its sentence and your own interpretation."
            }
            action={
              <button className="button secondary" onClick={onExplore}>
                Explore a word <ArrowRight size={16} />
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

function EncounterDialog({
  item,
  onClose,
  onDelete,
  onChat,
  onUpdate,
}: {
  item: Encounter;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onChat: () => void;
  onUpdate: (item: Encounter) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const [recall, setRecall] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const dialog = document.getElementById("encounter-dialog");
        const focusable = Array.from(
          dialog?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input,textarea,select",
          ) || [],
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    document.getElementById("close-encounter")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  async function remove() {
    if (!window.confirm(`Delete the saved encounter for “${item.expression}”?`))
      return;
    setBusy(true);
    try {
      await onDelete();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  async function uncertainty() {
    setBusy(true);
    setError("");
    try {
      await onUpdate(
        await api<Encounter>(
          `/encounters/${item.id}`,
          json({ unresolved: !item.unresolved }, "PATCH"),
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        id="encounter-dialog"
        className="encounter-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="encounter-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-top">
          <LanguageTag language={item.language} />
          <button
            id="close-encounter"
            className="icon-button"
            aria-label="Close encounter"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <h2 id="encounter-title">{item.expression}</h2>
        <div className="word-meta">
          <span>{item.explanation.partOfSpeech}</span>
          <span>{statusLabel(item)}</span>
          <span>Saved {dateLabel(item.createdAt)}</span>
        </div>
        <blockquote className="source-sentence">{item.sentence}</blockquote>
        <SourceLink url={item.sourceUrl} />
        {!revealed ? (
          <section className="saved-recall">
            <span className="eyebrow">MEET THE SENTENCE FIRST</span>
            <h3>What does “{item.expression}” mean here?</h3>
            {hint && (
              <div className="hint-box">
                <p>{item.explanation.clue}</p>
              </div>
            )}
            <label>
              Your recall (optional)
              <textarea
                rows={2}
                maxLength={1500}
                value={recall}
                onChange={(e) => setRecall(e.target.value)}
                placeholder="Try your own interpretation before revealing the saved explanation."
              />
            </label>
            <div className="button-row">
              <button
                className="button primary"
                onClick={() => setRevealed(true)}
              >
                Reveal saved explanation
              </button>
              <button
                className="button secondary"
                onClick={() => setHint(true)}
              >
                Request a clue
              </button>
            </div>
          </section>
        ) : (
          <>
            {recall && (
              <div className="first-interpretation">
                <span className="eyebrow">YOUR RECALL JUST NOW</span>
                <p>{recall}</p>
              </div>
            )}
            <ExplanationView explanation={item.explanation} />
          </>
        )}
        {revealed &&
          (item.initialInterpretation || item.revisedInterpretation) && (
            <section className="interpretation-record">
              {item.initialInterpretation && (
                <>
                  <span className="eyebrow">YOUR FIRST INTERPRETATION</span>
                  <p>{item.initialInterpretation}</p>
                </>
              )}
              {item.revisedInterpretation && (
                <>
                  <span className="eyebrow">AFTER EXPLORING</span>
                  <p>{item.revisedInterpretation}</p>
                </>
              )}
            </section>
          )}
        {revealed && item.checkResponse && (
          <section>
            <h4>Your new-context check</h4>
            <p>{item.checkResponse}</p>
          </section>
        )}
        {revealed && !!item.reviewHistory?.length && (
          <section className="review-history">
            <h4>Recent review reflections</h4>
            {item.reviewHistory
              .slice(-5)
              .reverse()
              .map((entry, index) => (
                <div key={`${entry.at}-${index}`}>
                  <span className="small muted">
                    {dateLabel(entry.at)} · {entry.rating}
                    {entry.unresolved ? " · Still uncertain" : ""}
                  </span>
                  <p>{entry.interpretation || "No interpretation recorded."}</p>
                  {entry.assistance.includes("review_clue") && (
                    <small>A contextual clue was requested.</small>
                  )}
                </div>
              ))}
          </section>
        )}
        {item.unresolved && (
          <div className="notice">
            You marked this encounter as unresolved. It’s okay to keep
            exploring.
          </div>
        )}
        {error && <ErrorNotice message={error} />}
        <button
          className="text-link encounter-uncertainty"
          disabled={busy}
          onClick={uncertainty}
        >
          {item.unresolved
            ? "I’m comfortable with this explanation now"
            : "Keep this explanation unresolved"}
        </button>
        <div className="dialog-actions">
          <button className="button primary" onClick={onChat}>
            <MessageCircle size={17} />
            Ask a follow-up
          </button>
          <button
            className="button danger-text"
            disabled={busy}
            onClick={remove}
          >
            {busy ? "Deleting…" : "Delete encounter"}
          </button>
        </div>
        <p className="small muted">
          AI explanations can be mistaken. Saved encounters record your
          exploration, not a claim of mastery.
        </p>
      </section>
    </div>
  );
}
