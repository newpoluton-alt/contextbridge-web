import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  Download,
  Globe2,
  Puzzle,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, errorMessage, json } from "../api";
import { ErrorNotice } from "../components/ui";
import type { Config, Mode, Settings } from "../types";

const languages = [
  "English",
  "German",
  "French",
  "Spanish",
  "Italian",
  "Portuguese",
  "Dutch",
  "Japanese",
  "Korean",
  "Ukrainian",
  "Russian",
  "Chinese",
  "Arabic",
  "Polish",
  "Turkish",
];
interface Usage {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reservedTokens: number;
  requestLimit: number;
  tokenLimit: number;
}
export default function Preferences({
  settings,
  config,
  onUpdate,
  onExport,
}: {
  settings: Settings;
  config: Config;
  onUpdate: () => Promise<void>;
  onExport: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const dirtyFields = useRef(new Set<keyof Settings>());
  const previousSettings = useRef(settings);
  const [remoteChanges, setRemoteChanges] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pair, setPair] = useState<{ code: string; expiresAt: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [usage, setUsage] = useState<Usage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState("");
  async function refreshUsage() {
    setUsageLoading(true);
    setUsageError("");
    try {
      setUsage(await api<Usage>("/usage"));
    } catch {
      setUsageError("Usage could not be loaded. Try refreshing.");
    } finally {
      setUsageLoading(false);
    }
  }
  useEffect(() => {
    void refreshUsage();
  }, []);
  useEffect(() => {
    const keys = Object.keys(settings) as (keyof Settings)[];
    if (
      keys.some(
        (key) =>
          dirtyFields.current.has(key) &&
          settings[key] !== previousSettings.current[key],
      )
    )
      setRemoteChanges(true);
    setDraft((current) => ({
      ...settings,
      ...Object.fromEntries(
        [...dirtyFields.current].map((key) => [key, current[key]]),
      ),
    }));
    previousSettings.current = settings;
  }, [settings]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  function field<K extends keyof Settings>(key: K, value: Settings[K]) {
    dirtyFields.current.add(key);
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const changes = Object.fromEntries(
        [...dirtyFields.current].map((key) => [key, draft[key]]),
      );
      const updated = await api<Settings>("/settings", json(changes, "PUT"));
      dirtyFields.current.clear();
      setDraft(updated);
      setRemoteChanges(false);
      await onUpdate();
      setNotice("Your preferences are saved. The extension will use them too.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }
  async function connect() {
    setBusy("pair");
    setError("");
    try {
      setPair(await api("/extension/pair", json({})));
      setCopied(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }
  async function copyCode() {
    if (!pair) return;
    try {
      await navigator.clipboard.writeText(pair.code);
      setCopied(true);
    } catch {
      setError("Please select the connection code and copy it manually.");
    }
  }
  const secondsLeft = pair
    ? Math.max(0, Math.ceil((new Date(pair.expiresAt).getTime() - now) / 1000))
    : 0;
  const tokensUsed = usage ? usage.inputTokens + usage.outputTokens : 0;
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE THIS SPACE YOURS</span>
          <h1>
            The way you like to learn<span className="heading-period">.</span>
          </h1>
          <p>
            Your preferences travel with you, from the web to the extension.
          </p>
        </div>
      </div>
      {error && <ErrorNotice message={error} onClose={() => setError("")} />}
      {remoteChanges && (
        <div className="notice" role="status">
          <span>
            Preferences changed in another window. Your unsaved edits are kept;
            saving applies only the fields you edited.
          </span>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              dirtyFields.current.clear();
              setDraft(settings);
              setRemoteChanges(false);
            }}
          >
            Use latest preferences
          </button>
        </div>
      )}
      {notice && (
        <div className="notice success" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      <div className="settings-layout">
        <form className="settings-main" onSubmit={save}>
          <section className="card settings-section">
            <div className="settings-section-heading">
              <span className="settings-icon">
                <Globe2 size={22} />
              </span>
              <div>
                <h2>A little about you</h2>
                <p>Build your vocabulary around your own language journey.</p>
              </div>
            </div>
            <label>
              Your name
              <input
                required
                maxLength={100}
                value={draft.name}
                onChange={(e) => field("name", e.target.value)}
                placeholder="Your name"
              />
            </label>
            <div className="form-grid">
              <label>
                Language you’re learning
                <select
                  value={draft.learningLanguage}
                  onChange={(e) => field("learningLanguage", e.target.value)}
                >
                  {[...new Set([draft.learningLanguage, ...languages])].map(
                    (l) => (
                      <option key={l}>{l}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Explanations and translations in
                <select
                  value={draft.translationLanguage}
                  onChange={(e) => field("translationLanguage", e.target.value)}
                >
                  {[...new Set([draft.translationLanguage, ...languages])].map(
                    (l) => (
                      <option key={l}>{l}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <label>
              Daily encounter goal
              <input
                type="number"
                min={1}
                max={100}
                required
                value={draft.dailyGoal}
                onChange={(e) => field("dailyGoal", Number(e.target.value))}
              />
              <span className="field-note">
                A personal intention, not a measure of proficiency.
              </span>
            </label>
          </section>
          <section className="card settings-section">
            <div className="settings-section-heading">
              <span className="settings-icon">
                <Sparkles size={22} />
              </span>
              <div>
                <h2>Your learning companion</h2>
                <p>Choose the kind of help you want to begin with.</p>
              </div>
            </div>
            <label>
              Default assistance
              <select
                value={draft.mode}
                onChange={(e) => field("mode", e.target.value as Mode)}
              >
                <option value="guided">
                  Help me work it out — begin with hints
                </option>
                <option value="direct">
                  Show me the meaning — explain directly
                </option>
              </select>
              <span className="field-note">
                You can switch at any point during an encounter.
              </span>
            </label>
            <label>
              What would you like your companion to know?
              <textarea
                rows={5}
                maxLength={2000}
                value={draft.instructions}
                onChange={(e) => field("instructions", e.target.value)}
                placeholder="For example: Keep explanations short. I’m comfortable with everyday German, but cases still confuse me."
              />
              <span className="field-note">
                Shared with your web and extension conversations. Avoid adding
                private or sensitive information.
              </span>
            </label>
          </section>
          <div className="settings-save">
            <span className="small muted">
              Preferences stay in your personal account.
            </span>
            <button className="button primary" disabled={!!busy}>
              <Save size={17} />
              {busy === "save" ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </form>
        <aside className="settings-aside">
          <section className="card usage-card" aria-labelledby="usage-heading">
            <div className="usage-heading">
              <div>
                <span className="eyebrow">
                  A LITTLE HELP, USED THOUGHTFULLY
                </span>
                <h3 id="usage-heading">Today’s AI usage</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Refresh AI usage"
                disabled={usageLoading}
                onClick={refreshUsage}
              >
                <RefreshCw size={16} className={usageLoading ? "spin" : ""} />
              </button>
            </div>
            {usage ? (
              <>
                <div className="usage-total">
                  <strong>{tokensUsed.toLocaleString()}</strong>
                  <span>of {usage.tokenLimit.toLocaleString()} tokens</span>
                </div>
                <div
                  className="usage-track"
                  role="progressbar"
                  aria-label="Daily AI token allowance used"
                  aria-valuemin={0}
                  aria-valuemax={usage.tokenLimit}
                  aria-valuenow={Math.min(tokensUsed, usage.tokenLimit)}
                >
                  <div
                    style={{
                      width: `${Math.min(100, (tokensUsed / Math.max(1, usage.tokenLimit)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="usage-detail">
                  <span>
                    {usage.requests.toLocaleString()} of{" "}
                    {usage.requestLimit.toLocaleString()} requests
                  </span>
                  {usage.reservedTokens > 0 && (
                    <span>A request is in progress</span>
                  )}
                </div>
              </>
            ) : (
              <p className="usage-state">
                {usageLoading
                  ? "Checking today’s usage…"
                  : "Usage is unavailable."}
              </p>
            )}
            {usageError && (
              <p className="usage-state" role="status">
                {usageError}
              </p>
            )}
            <p className="usage-note">
              Matching saved answers are reused, so a repeat lookup can avoid an
              AI call.
            </p>
          </section>
          <section className="card connect-card">
            <span className="settings-icon green">
              <Puzzle size={25} />
            </span>
            <span className="eyebrow">BRING CONTEXTBRIDGE ALONG</span>
            <h2>
              From any page
              <br />
              to your word library.
            </h2>
            <p>
              Connect the browser extension to save what you find and continue
              learning here.
            </p>
            <a
              className="button secondary full-width extension-download"
              href="/downloads/contextbridge-extension.zip"
              download
            >
              <Download size={16} />
              Download Chrome extension
            </a>
            <ol>
              <li>Download and unzip the extension above.</li>
              <li>
                Open <code>chrome://extensions</code>, turn on Developer mode,
                then choose <strong>Load unpacked</strong> and select the
                extracted folder.
              </li>
              <li>Open its settings and enter this website’s address.</li>
              <li>Generate a code here and paste it into the extension.</li>
            </ol>
            <label>
              Website address
              <input
                readOnly
                value={config.appUrl || window.location.origin}
                aria-label="Website address for extension"
              />
            </label>
            {pair && (
              <div className={`pair-code ${!secondsLeft ? "expired" : ""}`}>
                <span className="eyebrow">
                  {secondsLeft ? "ONE-TIME CONNECTION CODE" : "CODE EXPIRED"}
                </span>
                <code>{pair.code}</code>
                <div>
                  <span>
                    {secondsLeft
                      ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                      : "Generate a new code to connect."}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={!secondsLeft}
                    onClick={copyCode}
                    aria-label="Copy connection code"
                  >
                    {copied ? <Check size={17} /> : <Copy size={17} />}
                  </button>
                </div>
              </div>
            )}
            <button
              type="button"
              className="button primary full-width"
              disabled={!!busy}
              onClick={connect}
            >
              <Puzzle size={17} />
              {busy === "pair"
                ? "Generating…"
                : pair
                  ? "Generate a new code"
                  : "Connect your extension"}
            </button>
            <small className="muted">
              Treat this code like a sign-in link. It grants access to your
              library.
            </small>
          </section>
          <section className="card export-card">
            <Download size={22} />
            <h3>Take your words with you.</h3>
            <p>
              Export your encounters as an Anki-compatible file, with the
              original sentence and contextual explanation.
            </p>
            <button type="button" className="text-link" onClick={onExport}>
              Download Anki export <Download size={15} />
            </button>
          </section>
          <div className="privacy-note">
            <ShieldCheck size={21} />
            <p>
              Your library belongs to you. Saving is always your choice, and
              encounters can be deleted any time.
            </p>
          </div>
          {config.demo && (
            <div className="demo-settings">
              <strong>Local demo</strong>
              <p>
                {config.aiConfigured
                  ? "OpenAI is configured on the server."
                  : "OpenAI is not configured. The reading flow uses labeled sample explanations."}{" "}
                {config.storage === "local"
                  ? "Saved demo data stays on this computer."
                  : "Cloud storage is connected."}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
