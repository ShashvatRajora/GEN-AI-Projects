import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Settings, X, Bot, User,
  Thermometer, AlignJustify, Key, Eye, EyeOff,
  Activity, Trash2, AlertCircle, CheckCircle2, Loader2,
  Cpu, Globe, RefreshCw, ExternalLink, Info, Lock, Zap,
  ChevronDown,
} from "lucide-react";
import "./App.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

function uid() { return Math.random().toString(36).slice(2); }

// ── Tier badge ───────────────────────────────────────────────────────────────
function TierBadge({ model }) {
  if (!model) return null;
  if (model.preview && !model.free_tier)
    return <span className="badge badge-preview-paid"><Lock size={9}/> Paid · Preview</span>;
  if (model.preview)
    return <span className="badge badge-preview"><Zap size={9}/> Free · Preview</span>;
  if (!model.free_tier)
    return <span className="badge badge-paid"><Lock size={9}/> Paid</span>;
  return <span className="badge badge-free"><CheckCircle2 size={9}/> Free</span>;
}

// ── Tier info banner shown below the model selector ─────────────────────────
function TierBanner({ model, tierInfo }) {
  if (!model || !tierInfo) return null;

  if (!model.free_tier) {
    return (
      <div className="tier-banner tier-banner-paid">
        <Lock size={13}/>
        <span>
          <strong>Paid key required.</strong> {tierInfo.paid_note}{" "}
          <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">
            Upgrade →
          </a>
        </span>
      </div>
    );
  }
  return (
    <div className="tier-banner tier-banner-free">
      <Info size={13}/>
      <span>
        <strong>Free tier.</strong> {tierInfo.free_note}
      </span>
    </div>
  );
}

// ── Deprecation warning ──────────────────────────────────────────────────────
function DeprecationBanner({ tierInfo }) {
  if (!tierInfo?.deprecation_note) return null;
  return (
    <div className="tier-banner tier-banner-warn">
      <AlertCircle size={13}/>
      <span>{tierInfo.deprecation_note}</span>
    </div>
  );
}

// ── Key input ────────────────────────────────────────────────────────────────
function KeyInput({ label, value, onChange, placeholder, show, onToggle }) {
  return (
    <div className="key-input-wrap">
      <label className="field-label">{label}</label>
      <div className="key-input-inner">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-input"
          autoComplete="off"
          spellCheck={false}
        />
        <button className="eye-btn" onClick={onToggle} type="button">
          {show ? <EyeOff size={15}/> : <Eye size={15}/>}
        </button>
      </div>
    </div>
  );
}

// ── Slider ───────────────────────────────────────────────────────────────────
function Slider({ label, icon: Icon, value, onChange, min, max, step, format }) {
  return (
    <div className="slider-wrap">
      <div className="slider-header">
        <span className="field-label"><Icon size={13}/>{label}</span>
        <span className="slider-val">{format ? format(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value} onChange={e => onChange(Number(e.target.value))}
        className="range-input"
      />
      <div className="range-marks"><span>{min}</span><span>{max}</span></div>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    idle:       { icon: Activity,     label: "Ready",       cls: "status-idle"       },
    connecting: { icon: Loader2,      label: "Connecting…", cls: "status-connecting" },
    streaming:  { icon: Loader2,      label: "Generating…", cls: "status-streaming"  },
    error:      { icon: AlertCircle,  label: "Error",       cls: "status-error"      },
    done:       { icon: CheckCircle2, label: "Done",        cls: "status-done"       },
  };
  const { icon: Icon, label, cls } = map[status] || map.idle;
  return (
    <span className={`status-badge ${cls}`}>
      <Icon size={11} className={status === "streaming" || status === "connecting" ? "spin" : ""}/>
      {label}
    </span>
  );
}

// ── Message ──────────────────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`msg-row ${isUser ? "msg-user" : "msg-ai"}`}>
      <div className="msg-avatar">
        {isUser ? <User size={14}/> : <Bot size={14}/>}
      </div>
      <div className="msg-bubble">
        {isUser ? (
          <p>{msg.content}</p>
        ) : msg.content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        ) : (
          <span className="typing-cursor">▋</span>
        )}
        {msg.error && (
          <p className="msg-error"><AlertCircle size={13}/> {msg.error}</p>
        )}
      </div>
    </div>
  );
}

// ── Model selector — grouped by family with badges ───────────────────────────
function ModelSelector({ models, selectedModel, onChange, loading, error }) {
  // Group by family
  const groups = models.reduce((acc, m) => {
    const f = m.family || "Other";
    if (!acc[f]) acc[f] = [];
    acc[f].push(m);
    return acc;
  }, {});

  return (
    <div className="select-wrap">
      <select
        value={selectedModel}
        onChange={e => onChange(e.target.value)}
        className="select-input"
        disabled={loading || models.length === 0}
      >
        {models.length === 0 ? (
          <option value="">— no models —</option>
        ) : (
          Object.entries(groups).map(([family, fModels]) => (
            <optgroup key={family} label={family}>
              {fModels.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.preview   ? " [Preview]"    : ""}
                  {!m.free_tier ? " [Paid]"       : ""}
                </option>
              ))}
            </optgroup>
          ))
        )}
      </select>
      <ChevronDown size={14} className="select-icon"/>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [provider, setProvider]               = useState("google");
  const [googleKey, setGoogleKey]             = useState("");
  const [langsmithKey, setLangsmithKey]       = useState("");
  const [langsmithProject, setLangsmithProject] = useState("qna-chatbot");
  const [ollamaUrl, setOllamaUrl]             = useState("http://localhost:11434");

  const [models, setModels]                   = useState([]);
  const [tierInfo, setTierInfo]               = useState(null);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelsLoading, setModelsLoading]     = useState(false);
  const [modelsError, setModelsError]         = useState("");

  const [sidebarOpen, setSidebarOpen]         = useState(true);
  const [showGoogleKey, setShowGoogleKey]     = useState(false);
  const [showLsKey, setShowLsKey]             = useState(false);

  const [temperature, setTemperature]         = useState(0.7);
  const [maxTokens, setMaxTokens]             = useState(1024);
  const [status, setStatus]                   = useState("idle");
  const [messages, setMessages]               = useState([]);
  const [input, setInput]                     = useState("");

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const abortRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedModel = models.find(m => m.id === selectedModelId) || null;

  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError("");
    try {
      const res = await fetch(`${API_BASE}/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          api_key: googleKey || undefined,
          ollama_base_url: ollamaUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to fetch models");
      }
      const data = await res.json();
      setModels(data.models || []);
      setTierInfo(data.tier_info || null);
      if (data.models?.length > 0) setSelectedModelId(data.models[0].id);
    } catch (e) {
      setModelsError(e.message);
      setModels([]);
      setTierInfo(null);
    } finally {
      setModelsLoading(false);
    }
  }, [provider, googleKey, ollamaUrl]);

  useEffect(() => { fetchModels(); }, [provider]);

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || status === "streaming") return;

    const userMsg = { id: uid(), role: "user",      content: q };
    const aiMsg   = { id: uid(), role: "assistant",  content: "", error: null };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setInput("");
    setStatus("connecting");

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          question: q,
          provider,
          api_key: provider === "google" ? googleKey : undefined,
          langsmith_api_key: langsmithKey || undefined,
          langsmith_project: langsmithProject,
          model: selectedModelId,
          temperature,
          max_tokens: maxTokens,
          ollama_base_url: ollamaUrl,
          chat_history: history.slice(0, -1),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Request failed");
      }

      setStatus("streaming");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.chunk) {
              setMessages(prev => prev.map(m =>
                m.id === aiMsg.id ? { ...m, content: m.content + data.chunk } : m
              ));
            }
            if (data.done) setStatus("done");
          } catch (parseErr) {
            if (parseErr.message !== "Unexpected end of JSON input")
              throw parseErr;
          }
        }
      }
      setStatus("done");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      if (e.name === "AbortError") { setStatus("idle"); return; }
      setMessages(prev => prev.map(m =>
        m.id === aiMsg.id ? { ...m, error: e.message } : m
      ));
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const handleKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat  = () => { abortRef.current?.abort(); setMessages([]); setStatus("idle"); };
  const stopGen    = () => { abortRef.current?.abort(); setStatus("idle"); };

  // Warning hint shown below the chat input
  const inputHint = (() => {
    if (provider === "google" && !googleKey)
      return "⚠ Add your Google AI Studio key in settings";
    if (provider === "google" && selectedModel && !selectedModel.free_tier)
      return "⚠ Selected model requires a paid / billing-enabled key";
    if (provider === "ollama" && models.length === 0)
      return "⚠ Ensure Ollama is running and models are pulled";
    return "";
  })();

  return (
    <div className="app">
      <div className="bg-orb orb1"/>
      <div className="bg-orb orb2"/>
      <div className="bg-grid"/>

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon"><Bot size={18}/></span>
            <span className="logo-text">QnA<em>Bot</em></span>
          </div>
          <button className="icon-btn" onClick={() => setSidebarOpen(false)}>
            <X size={16}/>
          </button>
        </div>

        <div className="sidebar-body">

          {/* Provider */}
          <section className="config-section">
            <p className="section-title">Provider</p>
            <div className="provider-tabs">
              <button className={`prov-tab ${provider === "google" ? "active" : ""}`}
                onClick={() => setProvider("google")}>
                <Globe size={13}/> Google AI
              </button>
              <button className={`prov-tab ${provider === "ollama" ? "active" : ""}`}
                onClick={() => setProvider("ollama")}>
                <Cpu size={13}/> Ollama
              </button>
            </div>
          </section>

          {/* Keys */}
          <section className="config-section">
            <p className="section-title">API Keys</p>
            {provider === "google" && (
              <KeyInput
                label="Google AI Studio Key"
                value={googleKey}
                onChange={setGoogleKey}
                placeholder="AIza…"
                show={showGoogleKey}
                onToggle={() => setShowGoogleKey(v => !v)}
              />
            )}
            {provider === "ollama" && (
              <div className="key-input-wrap">
                <label className="field-label">Ollama Base URL</label>
                <input type="text" value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)}
                  className="text-input" placeholder="http://localhost:11434"/>
              </div>
            )}
            <KeyInput
              label="LangSmith API Key (optional)"
              value={langsmithKey}
              onChange={setLangsmithKey}
              placeholder="ls__…"
              show={showLsKey}
              onToggle={() => setShowLsKey(v => !v)}
            />
            {langsmithKey && (
              <div className="key-input-wrap">
                <label className="field-label">LangSmith Project</label>
                <input type="text" value={langsmithProject}
                  onChange={e => setLangsmithProject(e.target.value)}
                  className="text-input" placeholder="qna-chatbot"/>
              </div>
            )}
          </section>

          {/* Model */}
          <section className="config-section">
            <div className="section-title-row">
              <p className="section-title">Model</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {selectedModel && <TierBadge model={selectedModel}/>}
                <button className="refresh-btn" onClick={fetchModels} disabled={modelsLoading}>
                  <RefreshCw size={12} className={modelsLoading ? "spin" : ""}/>
                </button>
              </div>
            </div>

            {modelsError && (
              <p className="config-error"><AlertCircle size={12}/> {modelsError}</p>
            )}

            <ModelSelector
              models={models}
              selectedModel={selectedModelId}
              onChange={setSelectedModelId}
              loading={modelsLoading}
              error={modelsError}
            />

            {/* Model note */}
            {selectedModel?.note && (
              <p className="model-note"><Info size={11}/> {selectedModel.note}</p>
            )}

            {/* Tier banner */}
            {provider === "google" && (
              <TierBanner model={selectedModel} tierInfo={tierInfo}/>
            )}

            {/* Deprecation banner — always shown for Google */}
            {provider === "google" && tierInfo && (
              <DeprecationBanner tierInfo={tierInfo}/>
            )}
          </section>

          {/* Parameters */}
          <section className="config-section">
            <p className="section-title">Parameters</p>
            <Slider label="Temperature" icon={Thermometer}
              value={temperature} onChange={setTemperature}
              min={0} max={1} step={0.05} format={v => v.toFixed(2)}/>
            <Slider label="Max Tokens" icon={AlignJustify}
              value={maxTokens} onChange={setMaxTokens}
              min={128} max={4096} step={128}/>
          </section>

          {/* LangSmith link */}
          {langsmithKey && (
            <a href={`https://smith.langchain.com/o/default/projects/${langsmithProject}`}
              target="_blank" rel="noreferrer" className="ls-link">
              <Activity size={13}/> View in LangSmith <ExternalLink size={11}/>
            </a>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            {!sidebarOpen && (
              <button className="icon-btn" onClick={() => setSidebarOpen(true)}>
                <Settings size={17}/>
              </button>
            )}
            <h1 className="chat-title">
              {selectedModel ? (
                <span className="model-chip">
                  {selectedModel.name}
                  {selectedModel.preview && <span className="chip-tag">Preview</span>}
                </span>
              ) : "QnA Chatbot"}
            </h1>
          </div>
          <div className="topbar-right">
            <StatusBadge status={status}/>
            {messages.length > 0 && (
              <button className="icon-btn danger" onClick={clearChat} title="Clear chat">
                <Trash2 size={15}/>
              </button>
            )}
          </div>
        </header>

        <div className="messages-area">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Bot size={36}/></div>
              <h2>Ask me anything</h2>
              <p>Configure your provider and API key in the sidebar, then start chatting.</p>
              <div className="empty-hints">
                {["Explain quantum entanglement simply", "Write a Python quicksort", "What is LangSmith used for?"].map(h => (
                  <button key={h} className="hint-chip"
                    onClick={() => { setInput(h); inputRef.current?.focus(); }}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => <Message key={msg.id} msg={msg}/>)
          )}
          <div ref={bottomRef}/>
        </div>

        <div className="input-bar">
          <div className="input-wrap">
            <textarea ref={inputRef} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
              className="chat-input" rows={1}
              disabled={status === "connecting"}/>
            {status === "streaming" ? (
              <button className="send-btn stop" onClick={stopGen}><X size={17}/></button>
            ) : (
              <button className="send-btn" onClick={sendMessage}
                disabled={!input.trim() || status === "connecting"}>
                <Send size={17}/>
              </button>
            )}
          </div>
          {inputHint && <p className="input-hint">{inputHint}</p>}
        </div>
      </main>
    </div>
  );
}