import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { AGENT_EVENTS, announce, clearChat, getChat, sendChatFeedback, sendChatMessage } from "../../api/agentApi";
import { STATIC_SITE } from "../../staticSite";
import "./chat.css";

// What a correction can say the message was for
const CORRECTIONS = [
  { agent: "entry", label: "Add to my portfolio" },
  { agent: "design", label: "Change a design" },
  { agent: "qa", label: "Ask about my portfolio" }
];

const AGENT_OF_MESSAGE = { "data-entry": "entry", design: "design", qa: "qa" };

const AGENT_NAMES = {
  "data-entry": "Data entry agent",
  design: "Design agent",
  qa: "Q&A agent",
  supervisor: "Supervisor"
};

// One chat for everything: the supervisor detects what each message wants
const STARTERS = [
  "I did my MS in Computer Science at UNT from 2021 to 2023",
  "Add python, LangGraph and RAG to my skills",
  "Make a dark green Slate design called Forest",
  "What are my key skills?"
];

const SECTION_LABELS = {
  education: "Education", experience: "Experience", projects: "Projects", certifications: "Certifications",
  achievements: "Achievements", volunteering: "Volunteering", publications: "Publications", patents: "Patents", interests: "Interests"
};

function Message({ message, onChoice, onCorrect, busy }) {
  const mine = message.role === "user";
  const [correcting, setCorrecting] = useState(false);
  const choicesRef = useRef(null);
  const routedTo = AGENT_OF_MESSAGE[message.agent];

  useEffect(() => {
    if (correcting) choicesRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [correcting]);
  return (
    <div className={`uuv-chat-msg ${mine ? "is-mine" : ""}`}>
      {!mine && message.agent && <span className="uuv-chat-agent">{AGENT_NAMES[message.agent] || message.agent}</span>}
      <div className="uuv-chat-bubble">{message.text}</div>

      {!mine && message.links?.length > 0 && (
        <div className="uuv-chat-links">
          {message.links.map((link) => (
            <Link key={link.to + link.label} to={link.to} className="uuv-chat-link">
              {link.label} <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}

      {!mine && message.choices?.length > 0 && (
        <div className="uuv-chat-choices">
          {message.choices.map((choice) => (
            <button key={choice} type="button" className="uuv-chat-choice" disabled={busy} onClick={() => onChoice(choice)}>{choice}</button>
          ))}
        </div>
      )}

      {!mine && message.sources?.length > 0 && (
        <p className="uuv-chat-sources">
          Sources: {message.sources.map((source, index) => <span key={source.label}>[{index + 1}] {source.label}</span>)}
        </p>
      )}

      {!mine && (message.steps?.length > 0 || message.agent) && (
        <div className="uuv-chat-meta">
          {message.steps?.length > 0 && (
            <details className="uuv-chat-steps">
              <summary>How I did it</summary>
              <ol>{message.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
            </details>
          )}
          {!String(message.id).startsWith("local-") && message.agent && (
            <button type="button" className="uuv-chat-wrong" onClick={() => setCorrecting(!correcting)} disabled={busy} aria-expanded={correcting}>
              Not what I meant?
            </button>
          )}
        </div>
      )}

      {correcting && (
        <div className="uuv-chat-choices" ref={choicesRef}>
          {CORRECTIONS.filter((item) => item.agent !== routedTo).map((item) => (
            <button
              key={item.agent}
              type="button"
              className="uuv-chat-choice"
              disabled={busy}
              onClick={() => {
                setCorrecting(false);
                onCorrect(message.id, item.agent);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The assistant: a pop-up chat with the portfolio's agents
export default function ChatWidget({ raised = false }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [intentModel, setIntentModel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(null);
  const [ai, setAi] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open || loaded) return;
    getChat()
      .then(({ data }) => {
        setMessages(data.messages);
        setPending(data.pending);
        setAi(data.ai);
        setIntentModel(data.intentModel);
      })
      .catch(() => setError("Couldn't load the chat."))
      .finally(() => setLoaded(true));
  }, [open, loaded]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function received(data) {
    setPending(data.pending);
    if (data.ai) setAi((current) => ({ ...current, ...data.ai }));
    if (data.intentModel) setIntentModel(data.intentModel);
    if (data.changed?.buffer) announce(AGENT_EVENTS.buffer);
    if (data.changed?.designs) announce(AGENT_EVENTS.designs, { id: data.changed.designId });
  }

  async function send(value = text) {
    const message = value.trim();
    if (!message || busy) return;
    setText("");
    setError("");
    setBusy(true);
    setMessages((current) => [...current, { id: `local-${Date.now()}`, role: "user", text: message }]);

    try {
      const { data } = await sendChatMessage(message, "auto", { path: pathname });
      setMessages((current) => [...current.slice(0, -1), ...data.messages]);
      received(data);
    } catch (err) {
      setMessages((current) => current.slice(0, -1));
      setText(message);
      setError(err.response?.data?.message || "The agents couldn't answer. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // "Not what I meant": the message runs again with the chosen agent
  async function correct(messageId, agent) {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const { data } = await sendChatFeedback(messageId, agent, { path: pathname });
      setMessages((current) => [...current, ...data.messages]);
      received(data);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't send that correction.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError("");
    try {
      await clearChat();
      setMessages([]);
      setPending(null);
    } catch {
      setError("Couldn't clear the chat.");
    }
  }

  return (
    <div className={`uuv-chat d-print-none ${raised ? "is-raised" : ""}`}>
      {open && (
        <section className="uuv-chat-panel" role="dialog" aria-label="Assistant chat">
          <header className="uuv-chat-head">
            <div className="d-flex align-items-center gap-2 min-w-0">
              <span className="uuv-chat-logo" aria-hidden="true"><i className="bi bi-stars" /></span>
              <div className="min-w-0">
                <h2 className="uuv-chat-title">Assistant</h2>
                <p className="uuv-chat-status">
                  <span className={`uuv-chat-dot ${ai?.available ? "is-on" : ""}`} aria-hidden="true" />
                  {ai ? (ai.available ? `Agents online · ${ai.model}` : (STATIC_SITE ? "Agents on rules and ML (demo, no language model)" : "Agents on rules and ML (start Ollama for the AI)")) : "Connecting…"}
                  {intentModel && <span title={`Intent model ${intentModel.version}: ${intentModel.examples} training examples, ${intentModel.corrections} of them your corrections. Accuracy is 5-fold cross-validated.`}> · intent {Math.round(intentModel.accuracy * 100)}%</span>}
                </p>
              </div>
            </div>
            <div className="d-flex gap-1">
              <button type="button" className="uuv-chat-icon" onClick={reset} title="New conversation" aria-label="New conversation" disabled={busy}>
                <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
              </button>
              <button type="button" className="uuv-chat-icon" onClick={() => setOpen(false)} aria-label="Close chat">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="uuv-chat-list" ref={listRef} aria-live="polite">
            {loaded && messages.length === 0 && (
              <div className="uuv-chat-empty">
                <p className="fw-semibold mb-1">Just say what you need</p>
                <p className="small text-secondary mb-3">
                  I work out what you mean and hand it to the right agent: adding to any section (I ask for anything missing,
                  then put it in the buffer for you to confirm), changing a portfolio design, or answering questions about
                  your portfolio. If I pick wrong, tap "Not what I meant?" and I'll learn from it.
                </p>
                {STARTERS.map((starter) => (
                  <button key={starter} type="button" className="uuv-chat-starter" onClick={() => send(starter)}>{starter}</button>
                ))}
              </div>
            )}
            {messages.map((message) => <Message key={message.id} message={message} onChoice={send} onCorrect={correct} busy={busy} />)}
            {busy && (
              <div className="uuv-chat-msg">
                <div className="uuv-chat-bubble uuv-chat-typing" aria-label="Agents are working"><span /><span /><span /></div>
              </div>
            )}
          </div>

          {pending && (
            <p className="uuv-chat-pending">
              <i className="bi bi-hourglass-split" aria-hidden="true" /> Adding to {SECTION_LABELS[pending.section] || pending.section}: waiting for your answer
            </p>
          )}
          {error && <p className="uuv-chat-error" role="alert">{error}</p>}

          <form
            className="uuv-chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <label htmlFor="uuv-chat-input" className="visually-hidden">Message</label>
            <textarea
              id="uuv-chat-input"
              ref={inputRef}
              rows={1}
              value={text}
              maxLength={2000}
              placeholder={pending ? "Type your answer…" : "Add, design or ask anything…"}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <button type="submit" className="uuv-chat-send" disabled={busy || !text.trim()} aria-label="Send">
              <i className="bi bi-send-fill" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`uuv-chat-fab ${open ? "is-open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
      >
        <i className={`bi ${open ? "bi-chevron-down" : "bi-chat-dots-fill"}`} aria-hidden="true" />
        {!open && pending && <span className="uuv-chat-badge" aria-label="An entry is waiting for your answer" />}
      </button>
    </div>
  );
}
