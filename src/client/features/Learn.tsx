import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookmarkPlus,
  Check,
  ChevronDown,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { api, errorMessage, json } from "../api";
import {
  ErrorNotice,
  ExplanationView,
  LanguageTag,
  SourceLink,
} from "../components/ui";
import { isEncounterOrNull, isLookupOrNull, useSessionState } from "../drafts";
import type {
  Config,
  Encounter,
  LearningContext,
  Lookup,
  Mode,
  Settings,
} from "../types";

export default function Learn({
  draftKey,
  items,
  settings,
  config,
  onSaved,
  onChat,
}: {
  draftKey: string;
  items: Encounter[];
  settings: Settings;
  config: Config;
  onSaved: () => Promise<void>;
  onChat: (item: LearningContext) => void;
}) {
  const [expression, setExpression] = useSessionState(
    `${draftKey}:expression`,
    "",
  );
  const [sentence, setSentence] = useSessionState(`${draftKey}:sentence`, "");
  const [sourceUrl, setSourceUrl] = useSessionState(
    `${draftKey}:sourceUrl`,
    "",
  );
  const [language, setLanguage] = useSessionState(
    `${draftKey}:language`,
    settings.learningLanguage,
  );
  const [mode, setMode] = useSessionState<Mode>(
    `${draftKey}:mode`,
    settings.mode,
    (value): value is Mode => value === "guided" || value === "direct",
  );
  const [result, setResult] = useSessionState<Lookup | null>(
    `${draftKey}:result`,
    null,
    isLookupOrNull,
  );
  const [translationLanguage, setTranslationLanguage] = useSessionState(
    `${draftKey}:translationLanguage`,
    settings.translationLanguage,
  );
  useEffect(() => {
    if (!result) setTranslationLanguage(settings.translationLanguage);
  }, [settings.translationLanguage, result]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [interpretation, setInterpretation] = useSessionState(
    `${draftKey}:interpretation`,
    "",
  );
  const [revision, setRevision] = useSessionState(`${draftKey}:revision`, "");
  const [feedback, setFeedback] = useSessionState(`${draftKey}:feedback`, "");
  const [revealed, setRevealed] = useSessionState(
    `${draftKey}:revealed`,
    false,
  );
  const [hint, setHint] = useSessionState(`${draftKey}:hint`, false);
  const [grammarHint, setGrammarHint] = useSessionState(
    `${draftKey}:grammarHint`,
    false,
  );
  const [assistance, setAssistance] = useSessionState<string[]>(
    `${draftKey}:assistance`,
    [],
  );
  const [unresolved, setUnresolved] = useSessionState(
    `${draftKey}:unresolved`,
    false,
  );
  const [compare, setCompare] = useSessionState(`${draftKey}:compare`, false);
  const [checkOpen, setCheckOpen] = useSessionState(
    `${draftKey}:checkOpen`,
    false,
  );
  const [checkResponse, setCheckResponse] = useSessionState(
    `${draftKey}:checkResponse`,
    "",
  );
  const [checkFeedback, setCheckFeedback] = useSessionState(
    `${draftKey}:checkFeedback`,
    "",
  );
  const [checkRevealed, setCheckRevealed] = useSessionState(
    `${draftKey}:checkRevealed`,
    false,
  );
  const [checkHelp, setCheckHelp] = useSessionState(
    `${draftKey}:checkHelp`,
    false,
  );
  const [saved, setSaved] = useSessionState<Encounter | null>(
    `${draftKey}:saved`,
    null,
    isEncounterOrNull,
  );
  useEffect(() => {
    if (saved && !items.some((item) => item.id === saved.id)) setSaved(null);
  }, [items]);
  const [confirmedComparisons, setConfirmedComparisons] = useSessionState<
    string[]
  >(`${draftKey}:confirmedComparisons`, []);
  const mark = (step: string) => {
    setAssistance((current) =>
      current.length < 30 ? [...current, step] : current,
    );
    setSaved(null);
  };
  function resetResult() {
    setResult(null);
    setSaved(null);
    setInterpretation("");
    setRevision("");
    setFeedback("");
    setRevealed(false);
    setHint(false);
    setGrammarHint(false);
    setAssistance([]);
    setUnresolved(false);
    setCompare(false);
    setConfirmedComparisons([]);
    setCheckOpen(false);
    setCheckResponse("");
    setCheckFeedback("");
    setCheckRevealed(false);
    setCheckHelp(false);
    setError("");
  }
  async function explore(e: FormEvent) {
    e.preventDefault();
    setBusy("lookup");
    setError("");
    try {
      const next = await api<Lookup>(
        "/lookup",
        json({
          expression: expression.trim(),
          sentence: sentence.trim(),
          language,
          translationLanguage,
          mode,
        }),
      );
      resetResult();
      setResult(next);
      setRevealed(mode === "direct");
      const normalized = (text: string) => text.trim().replace(/\s+/gu, " ");
      const existing = next.matches.find(
        (item) =>
          !item.unresolved &&
          normalized(item.expression) === normalized(expression) &&
          normalized(item.sentence) === normalized(sentence) &&
          item.language.toLowerCase() === language.toLowerCase() &&
          item.translationLanguage.toLowerCase() ===
            translationLanguage.toLowerCase(),
      );
      if (existing) {
        setSaved(existing);
        setInterpretation(existing.initialInterpretation);
        setRevision(existing.revisedInterpretation);
        setCheckResponse(existing.checkResponse);
        setAssistance(existing.assistance);
        setSourceUrl(sourceUrl || existing.sourceUrl);
      } else if (mode === "direct") setAssistance(["direct_explanation"]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }
  async function submitInterpretation(kind: "interpretation" | "check") {
    if (!result) return;
    mark(kind === "check" ? "check_attempt" : "initial_attempt");
    setBusy(kind);
    setError("");
    try {
      const response = await api<{ feedback: string }>(
        "/feedback",
        json({
          expression,
          sentence:
            kind === "check" ? result.explanation.check.sentence : sentence,
          interpretation: kind === "check" ? checkResponse : interpretation,
          explanation: result.explanation,
          kind,
        }),
      );
      if (kind === "check") setCheckFeedback(response.feedback);
      else {
        setFeedback(response.feedback);
        setRevealed(true);
      }
      setSaved(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }
  async function save() {
    if (!result) return;
    setBusy("save");
    setError("");
    try {
      const item = await api<Encounter>(
        "/encounters",
        json({
          expression: expression.trim(),
          sentence: sentence.trim(),
          language,
          translationLanguage,
          sourceUrl,
          mode,
          explanation: result.explanation,
          initialInterpretation: interpretation,
          revisedInterpretation: revision,
          assistance,
          checkResponse,
          unresolved,
          attemptStatus:
            interpretation.trim() || checkResponse.trim()
              ? assistance.length
                ? "assisted"
                : "attempted"
              : "not_attempted",
        }),
      );
      setSaved(item);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }
  function showAnswer() {
    setRevealed(true);
    mark("explanation_revealed");
    setSaved(null);
  }
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
          <h1>
            One word. More meaning<span className="heading-period">.</span>
          </h1>
          <p>Bring a sentence. Keep the context. See what you discover.</p>
        </div>
      </div>
      <div className="learning-layout">
        <section className="card context-input-card">
          <div className="section-heading">
            <div>
              <span className="step-label">01 / THE MOMENT</span>
              <h2>What caught your attention?</h2>
            </div>
            <Sparkles size={23} />
          </div>
          <form onSubmit={explore}>
            <label>
              Word or short expression
              <input
                required
                maxLength={120}
                value={expression}
                disabled={!!result}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="e.g. addresses"
              />
            </label>
            <label>
              Its original sentence
              <textarea
                required
                rows={5}
                maxLength={2400}
                value={sentence}
                disabled={!!result}
                onChange={(e) => setSentence(e.target.value)}
                placeholder="The proposal addresses the housing shortage by funding new construction."
              />
              <span className="field-note">
                Include enough context to see how the expression is used.
              </span>
            </label>
            <label>
              Language
              <select
                value={language}
                disabled={!!result}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {[
                  ...new Set([
                    settings.learningLanguage,
                    "English",
                    "German",
                    "French",
                    "Spanish",
                    "Italian",
                    "Portuguese",
                    "Japanese",
                    "Korean",
                    "Dutch",
                    "Ukrainian",
                  ]),
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <details className="optional-fields">
              <summary>
                Include a source link <ChevronDown size={14} />
              </summary>
              <label className="sr-only" htmlFor="source-url">
                Source URL
              </label>
              <input
                id="source-url"
                type="url"
                value={sourceUrl}
                onChange={(e) => {
                  setSourceUrl(e.target.value);
                  setSaved(null);
                }}
                placeholder="https://…"
              />
            </details>
            <fieldset className="mode-fieldset">
              <legend>How would you like to explore?</legend>
              <button
                type="button"
                className={`mode-option ${mode === "guided" ? "selected" : ""}`}
                onClick={() => {
                  setMode("guided");
                  if (result) setRevealed(false);
                }}
              >
                <Lightbulb size={19} />
                <span>
                  <strong>Help me work it out</strong>
                  <small>A contextual question, then hints.</small>
                </span>
                <span className="radio-circle" />
              </button>
              <button
                type="button"
                className={`mode-option ${mode === "direct" ? "selected" : ""}`}
                onClick={() => {
                  setMode("direct");
                  if (result) showAnswer();
                }}
              >
                <Sparkles size={19} />
                <span>
                  <strong>Show me the meaning</strong>
                  <small>Go straight to an explanation.</small>
                </span>
                <span className="radio-circle" />
              </button>
            </fieldset>
            {result ? (
              <button
                type="button"
                className="button secondary full-width"
                onClick={resetResult}
              >
                <RefreshCw size={16} />
                Explore another context
              </button>
            ) : (
              <button className="button primary full-width" disabled={!!busy}>
                {busy === "lookup" ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <>
                    Explore this expression
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            )}
          </form>
          {config.demo && (
            <button
              className="demo-example"
              disabled={!!result}
              onClick={() => {
                setExpression("addresses");
                setSentence(
                  "The proposal addresses the housing shortage by funding new construction.",
                );
                setLanguage("English");
              }}
            >
              Try the “addresses” sample <ArrowUpRightSmall />
            </button>
          )}
        </section>
        <section className="learning-workspace">
          {error && <ErrorNotice message={error} />}
          {!result ? (
            <div className="learning-placeholder">
              <div className="learning-flower">✳</div>
              <span className="eyebrow">A WORD IS ONLY THE BEGINNING</span>
              <h2>
                Let the sentence
                <br />
                tell you more.
              </h2>
              <p>
                Choose a little guidance or a direct explanation.
                <br />
                You can change your mind at any time.
              </p>
              <div className="learning-path">
                <span>Notice</span>
                <ArrowRight size={13} />
                <span>Explore</span>
                <ArrowRight size={13} />
                <span>Connect</span>
              </div>
            </div>
          ) : (
            <div className="card assistance-card">
              <div className="result-top">
                <LanguageTag language={language} />
                <span className="small muted">
                  {result.source === "demo"
                    ? "Sample explanation"
                    : result.cached
                      ? "Reused response · no new AI call"
                      : "AI learning support"}
                </span>
              </div>
              <h2 className="selected-expression">{expression}</h2>
              <blockquote className="source-sentence">{sentence}</blockquote>
              {sourceUrl && <SourceLink url={sourceUrl} />}
              {!checkOpen && result.matches.length > 0 && (
                <div className="prior-encounter">
                  <span className="eyebrow">AN EARLIER CONNECTION?</span>
                  <p>
                    You’ve saved {result.matches.length} earlier{" "}
                    {result.matches.length === 1 ? "encounter" : "encounters"}.
                    Choose whether an earlier expression is relevant before
                    comparing meanings.
                  </p>
                  <button
                    className="text-link"
                    onClick={() => {
                      setCompare(!compare);
                      if (!compare) mark("earlier_examples_opened");
                    }}
                  >
                    {compare
                      ? "Hide earlier examples"
                      : "Compare with an earlier example"}
                    <ChevronDown size={15} />
                  </button>
                  {compare &&
                    result.matches.slice(0, 3).map((item) => (
                      <div className="comparison-item" key={item.id}>
                        <blockquote>“{item.sentence}”</blockquote>
                        <small>
                          Earlier expression: <strong>{item.expression}</strong>
                        </small>
                        {confirmedComparisons.includes(item.id) ? (
                          <>
                            <p>{item.explanation.meaning}</p>
                            <small>
                              Does this earlier meaning fit? Point to evidence
                              in the new sentence.
                            </small>
                          </>
                        ) : (
                          <div className="comparison-choice">
                            <p>Is this the expression you want to compare?</p>
                            <button
                              className="text-link"
                              onClick={() => {
                                setConfirmedComparisons((current) => [
                                  ...current,
                                  item.id,
                                ]);
                                mark("earlier_meaning_revealed");
                              }}
                            >
                              Yes — show its earlier meaning
                            </button>
                            <button
                              className="text-link"
                              onClick={() => setCompare(false)}
                            >
                              Continue with my current context
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
              {!checkOpen && (
                <>
                  {mode === "guided" && !revealed && (
                    <div className="guided-step">
                      <span className="step-label">
                        02 / YOUR INTERPRETATION
                      </span>
                      <h3>{result.explanation.question}</h3>
                      {hint && (
                        <div className="hint-box">
                          <Lightbulb size={18} />
                          <p>{result.explanation.clue}</p>
                        </div>
                      )}
                      {grammarHint && (
                        <div className="hint-box">
                          <BookIcon />
                          <p>{result.explanation.grammar}</p>
                        </div>
                      )}
                      <label>
                        Your first idea
                        <textarea
                          rows={3}
                          value={interpretation}
                          onChange={(e) => {
                            setInterpretation(e.target.value);
                            setSaved(null);
                          }}
                          placeholder="I think it means…"
                          maxLength={1500}
                        />
                      </label>
                      <div className="button-row">
                        <button
                          className="button primary"
                          disabled={!!busy || !interpretation.trim()}
                          onClick={() => submitInterpretation("interpretation")}
                        >
                          {busy === "interpretation"
                            ? "Thinking…"
                            : "Check my interpretation"}
                          <ArrowRight size={16} />
                        </button>
                        <button
                          className="button secondary"
                          onClick={() => {
                            if (!hint) {
                              setHint(true);
                              mark("context_clue");
                            } else {
                              setGrammarHint(true);
                              mark("grammar_hint");
                            }
                          }}
                        >
                          {hint ? "Another clue" : "I’m not sure"}
                        </button>
                      </div>
                      <button
                        className="text-link reveal-link"
                        onClick={showAnswer}
                      >
                        Show me the explanation <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                  {feedback && (
                    <div className="feedback-box">
                      <span className="eyebrow">LET’S COMPARE</span>
                      <p>{feedback}</p>
                    </div>
                  )}
                  {revealed && (
                    <>
                      <ExplanationView explanation={result.explanation} />
                      <div className="revision-area">
                        {interpretation && (
                          <div className="first-interpretation">
                            <span className="eyebrow">YOUR FIRST IDEA</span>
                            <p>{interpretation}</p>
                          </div>
                        )}
                        <label>
                          {interpretation
                            ? "Your revised interpretation (optional)"
                            : "Put it in your own words (optional)"}
                          <textarea
                            rows={2}
                            maxLength={1500}
                            value={revision}
                            onChange={(e) => {
                              setRevision(e.target.value);
                              setSaved(null);
                            }}
                            placeholder="Now I would describe it as…"
                          />
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={unresolved}
                            onChange={(e) => {
                              setUnresolved(e.target.checked);
                              setSaved(null);
                            }}
                          />
                          I’m not convinced yet — keep this unresolved
                        </label>
                      </div>
                      <div className="check-invitation">
                        <div>
                          <span className="eyebrow">ONE MORE CONNECTION?</span>
                          <h3>Try it in another sentence.</h3>
                          <p>
                            An optional check, with the explanation tucked away.
                          </p>
                        </div>
                        <button
                          className="button secondary"
                          onClick={() => {
                            setCheckOpen(true);
                            setCheckResponse("");
                            setCheckFeedback("");
                            setCheckRevealed(false);
                            setCheckHelp(false);
                            mark("check_started");
                          }}
                        >
                          Give it a try <ArrowRight size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
              {checkOpen && (
                <div className="new-context">
                  <span className="step-label">03 / A NEW CONTEXT</span>
                  <h3>What carries over?</h3>
                  <blockquote>{result.explanation.check.sentence}</blockquote>
                  <p>{result.explanation.check.question}</p>
                  {checkHelp && (
                    <div className="hint-box">
                      <Lightbulb size={17} />
                      <p>
                        Look at the words around the expression. Does its role
                        and the surrounding action fit the meaning you explored?
                      </p>
                    </div>
                  )}
                  <label>
                    Your interpretation
                    <textarea
                      rows={3}
                      value={checkResponse}
                      maxLength={1500}
                      onChange={(e) => {
                        setCheckResponse(e.target.value);
                        setSaved(null);
                      }}
                      placeholder="In this sentence, I think…"
                    />
                  </label>
                  <div className="button-row">
                    <button
                      className="button primary"
                      disabled={!!busy || !checkResponse.trim()}
                      onClick={() => submitInterpretation("check")}
                    >
                      {busy === "check" ? "Thinking…" : "Check my response"}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setCheckHelp(true);
                        mark("check_help");
                      }}
                    >
                      A little help
                    </button>
                    <button
                      className="text-link"
                      onClick={() => {
                        setCheckRevealed(true);
                        mark("check_reveal");
                      }}
                    >
                      Reveal
                    </button>
                  </div>
                  {checkFeedback && (
                    <div className="feedback-box">
                      <p>{checkFeedback}</p>
                    </div>
                  )}
                  {checkRevealed && (
                    <div className="example-block">
                      <h4>A possible interpretation</h4>
                      <p>{result.explanation.check.answer}</p>
                    </div>
                  )}
                  <button
                    className="text-link reveal-link"
                    onClick={() => setCheckOpen(false)}
                  >
                    Back to the explanation / skip
                  </button>
                </div>
              )}
              <div className="save-bar">
                <div>
                  <strong>
                    {saved
                      ? "A new connection, safely kept."
                      : "Keep this encounter?"}
                  </strong>
                  <small>
                    {saved
                      ? "Find it in your word library."
                      : "Your sentence, support, and interpretations stay together."}
                  </small>
                </div>
                <button
                  className={`button ${saved ? "saved-button" : "primary"}`}
                  disabled={!!busy || !!saved}
                  onClick={save}
                >
                  {saved ? <Check size={17} /> : <BookmarkPlus size={17} />}
                  {saved
                    ? "Saved"
                    : busy === "save"
                      ? "Saving…"
                      : "Save encounter"}
                </button>
              </div>
              {result && (
                <button
                  className="text-link followup-link"
                  onClick={() =>
                    onChat(
                      saved || {
                        expression,
                        sentence,
                        language,
                        translationLanguage,
                        mode,
                        explanation: result.explanation,
                        initialInterpretation: interpretation,
                        revisedInterpretation: revision,
                        assistance,
                        unresolved,
                      },
                    )
                  }
                >
                  <MessageCircle size={16} />
                  Ask a follow-up about this encounter
                  <ArrowRight size={15} />
                </button>
              )}
              <p className="small muted">
                AI feedback is a starting point. You can question it, request
                help, or stop here.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
function ArrowUpRightSmall() {
  return <ArrowRight size={14} />;
}
function BookIcon() {
  return <Sparkles size={18} />;
}
