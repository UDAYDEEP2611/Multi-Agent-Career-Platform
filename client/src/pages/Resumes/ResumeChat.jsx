import { useEffect, useRef, useState } from "react";
import { Offcanvas } from "react-bootstrap";

import { AGENT_EVENTS, announce, getResumeChatStatus, sendResumeChat } from "../../api/agentApi";
import "./resumeChat.css";

// The conversation is kept per design for this browser tab
const storageKey = (designId) => `uuv.resume.chat.${designId}`;
function readMessages(designId) {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(designId)) || "[]");
  } catch {
    return [];
  }
}

// What each step of the agent used, as a small tag
const STEP_TAGS = [
  [/Read your words/, "NLP"],
  [/trained models/, "ML"],
  [/GraphRAG/, "GraphRAG"],
  [/search|BM25|embeddings/i, "RAG"],
  [/A2A/, "A2A"],
  [/MCP/, "MCP"],
  [/language model/i, "LLM"],
  [/rules|in-process/i, "Rules"]
];
const tagsOf = (step) => STEP_TAGS.filter(([pattern]) => pattern.test(step)).map(([, tag]) => tag);

// Entries left off this resume, named from the portfolio
const LISTS = { experience: "experiences", education: "educations", projects: "projects", skills: "skills", certifications: "certifications", achievements: "achievements", volunteering: "volunteering", publications: "publications", patents: "patents", interests: "interests", recommendations: "recommendations" };
function labelOf(key, data) {
  const [section, id] = key.split(":");
  const item = (data?.[LISTS[section]] || []).find((entry) => entry.id === id);
  if (!item) return null;
  return item.name || item.title || item.institution || section;
}

function suggestionsFor(data) {
  const project = data?.projects?.[0]?.title;
  return [
    project && { icon: "bi-eye-slash", text: `Hide ${project}` },
    { icon: "bi-kanban", text: "Only 1 project" },
    { icon: "bi-patch-check", text: "Show all my certifications" },
    { icon: "bi-heart", text: "Add interests" },
    { icon: "bi-palette", text: "Make it navy" },
    { icon: "bi-list-check", text: "What's on this resume?" }
  ].filter(Boolean);
}

// The AI chat on one designed resume. The resume customizer agent (LangGraph,
// with MCP tools, RAG / GraphRAG to find entries and A2A for colours) changes
// this resume, all resumes or the portfolio, and shows how it did it.
export default function ResumeChat({ show, onHide, design, data, hiddenEntries = [], accent, onSettings, onShowEntry }) {
  const [messages, setMessages] = useState(() => readMessages(design.id));
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [ai, setAi] = useState(null);
  const end = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    if (!show) return undefined;
    let active = true;
    getResumeChatStatus().then(({ data: status }) => active && setAi(status.ai)).catch(() => active && setAi({ available: false }));
    return () => {
      active = false;
    };
  }, [show]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(design.id), JSON.stringify(messages.slice(-40)));
    } catch {
      // remembering the chat is optional
    }
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, sending, design.id]);

  const send = async (message) => {
    const clean = message.trim();
    if (!clean || sending) return;
    setText("");
    setError("");
    setSending(true);
    setMessages((current) => [...current, { role: "user", text: clean }]);
    try {
      const { data: result } = await sendResumeChat(design.id, clean, design.layout);
      if (result.ai) setAi(result.ai);
      setMessages((current) => [...current, { role: "assistant", text: result.reply, steps: result.steps, changed: result.changed, readAs: result.readAs }]);
      onSettings(result.settings);
      // Entries switched on or off reload the portfolio data
      if (result.changed) announce(AGENT_EVENTS.portfolio);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't reach the resume agent. Check that the server is running and try again.");
      setText(clean);
    } finally {
      setSending(false);
      input.current?.focus();
    }
  };

  const hidden = hiddenEntries.map((key) => ({ key, label: labelOf(key, data) })).filter((entry) => entry.label);

  return (
    <Offcanvas
      show={show}
      onHide={onHide}
      placement="end"
      // The resume stays in view and usable, so changes show as they happen
      backdrop={false}
      scroll
      enforceFocus={false}
      className="rd-chat d-print-none"
      style={{ "--rd-chat-accent": accent }}
      aria-labelledby="rd-chat-title"
    >
      <header className="rd-chat-head">
        <span className="rd-chat-avatar" aria-hidden="true"><i className="bi bi-magic" /></span>
        <div className="flex-grow-1 min-w-0">
          <h2 id="rd-chat-title" className="rd-chat-title">Customize {design.name}</h2>
          <p className={`rd-chat-status ${ai?.available ? "is-live" : ""}`}>
            <span className="rd-chat-dot" aria-hidden="true" />
            {!ai ? "Connecting…" : ai.available ? `AI agent · ${ai.model}` : "Built-in rules · start Ollama for free-form requests"}
          </p>
        </div>
        <button type="button" className="btn-close" onClick={onHide} aria-label="Close" />
      </header>

      <div className="rd-chat-log" aria-live="polite">
        {!messages.length && (
          <div className="rd-chat-intro">
            <h3>What should this resume show?</h3>
            <p>Hide or bring back any entry by its name or what it uses, change how many jobs and projects it lists, remove one detail like a grade, draw skills in boxes, add sections, move a section to the other column, or recolour it.</p>
            <p className="rd-chat-scope"><i className="bi bi-info-circle" aria-hidden="true" /> Only this resume changes, unless you say "all my resumes" or "my portfolio".</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`rd-chat-msg ${message.role === "user" ? "is-user" : ""}`}>
            {message.readAs && <p className="rd-chat-readas"><i className="bi bi-spellcheck" aria-hidden="true" /> Read as: {message.readAs}</p>}
            <div className="rd-chat-bubble">
              {message.changed && <i className="bi bi-check-circle-fill rd-chat-done" aria-hidden="true" />}
              {message.text}
            </div>
            {message.steps?.length > 0 && (
              <details className="rd-chat-steps">
                <summary>How the agent did it</summary>
                <ol>
                  {message.steps.map((step) => (
                    <li key={step}>
                      <span>{step}</span>
                      {tagsOf(step).map((tag) => <em key={tag}>{tag}</em>)}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        ))}

        {sending && (
          <div className="rd-chat-msg">
            <div className="rd-chat-bubble rd-chat-typing" role="status" aria-label="The agent is working">
              <span /><span /><span />
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-danger py-2 px-3 small mb-0" role="alert">
            {error}
          </div>
        )}
        <div ref={end} />
      </div>

      <footer className="rd-chat-foot">
        {hidden.length > 0 && (
          <div className="rd-chat-hidden">
            <span>Left off this resume</span>
            {hidden.map((entry) => (
              <button key={entry.key} type="button" onClick={() => onShowEntry(entry.key)} title={`Put ${entry.label} back`}>
                {entry.label} <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        <div className="rd-chat-chips" aria-label="Suggestions">
          {suggestionsFor(data).map(({ icon, text: suggestion }) => (
            <button key={suggestion} type="button" disabled={sending} onClick={() => send(suggestion)}>
              <i className={`bi ${icon}`} aria-hidden="true" /> {suggestion}
            </button>
          ))}
        </div>

        <form
          className="rd-chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            send(text);
          }}
        >
          <input
            ref={input}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What should change on this resume?"
            maxLength={1000}
            aria-label="Message to the resume agent"
          />
          <button type="submit" disabled={sending || !text.trim()} aria-label="Send">
            <i className="bi bi-arrow-up" aria-hidden="true" />
          </button>
        </form>

        {messages.length > 0 && (
          <div className="rd-chat-actions">
            <button type="button" disabled={sending} onClick={() => send("Reset this resume")}>Reset this resume</button>
            <button type="button" onClick={() => setMessages([])}>Clear chat</button>
          </div>
        )}
      </footer>
    </Offcanvas>
  );
}
