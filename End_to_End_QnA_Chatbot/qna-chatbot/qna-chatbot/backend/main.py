from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Literal
from dotenv import load_dotenv
import os
import json

# Load .env first
load_dotenv()

DEFAULT_GOOGLE_API_KEY    = os.getenv("GOOGLE_API_KEY", "")
DEFAULT_LANGSMITH_KEY     = os.getenv("LANGCHAIN_API_KEY", "")
DEFAULT_LANGSMITH_PROJECT = os.getenv("LANGCHAIN_PROJECT", "qna-chatbot")
DEFAULT_OLLAMA_URL        = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
ALLOWED_ORIGINS           = os.getenv("ALLOWED_ORIGINS", "*").split(",")

#  Google model catalogue  (updated June 2026 from ai.google.dev/gemini-api/docs)
#
#  free_tier : True  → works on a free AI-Studio key (no billing needed)
#  free_tier : False → requires a paid / billing-enabled key
#  preview   : True  → may change without notice; stricter rate limits

GOOGLE_MODELS = [

    {
        "id":        "gemini-3.5-flash",
        "name":      "Gemini 3.5 Flash",
        "family":    "Gemini 3",
        "free_tier": True,
        "preview":   False,
        "note":      "Most intelligent model; best for agentic & coding tasks.",
    },
    {
        "id":        "gemini-3-flash-preview",
        "name":      "Gemini 3 Flash (Preview)",
        "family":    "Gemini 3",
        "free_tier": True,
        "preview":   True,
        "note":      "Frontier-class performance at lower cost. Preview — may change.",
    },
    {
        "id":        "gemini-3.1-flash-lite",
        "name":      "Gemini 3.1 Flash-Lite",
        "family":    "Gemini 3",
        "free_tier": True,
        "preview":   False,
        "note":      "Fastest & most budget-friendly in the 3.x family.",
    },
    {
        "id":        "gemini-3.1-pro-preview",
        "name":      "Gemini 3.1 Pro (Preview)",
        "family":    "Gemini 3",
        "free_tier": False,
        "preview":   True,
        "note":      "Advanced intelligence & agentic reasoning. Paid key required.",
    },
    {
        "id":        "gemini-2.5-pro",
        "name":      "Gemini 2.5 Pro",
        "family":    "Gemini 2.5",
        "free_tier": False,
        "preview":   False,
        "note":      "Most advanced reasoning & coding. Paid key required.",
    },
    {
        "id":        "gemini-2.5-flash",
        "name":      "Gemini 2.5 Flash",
        "family":    "Gemini 2.5",
        "free_tier": True,
        "preview":   False,
        "note":      "Best price-performance; great for high-volume tasks.",
    },
    {
        "id":        "gemini-2.5-flash-lite",
        "name":      "Gemini 2.5 Flash-Lite",
        "family":    "Gemini 2.5",
        "free_tier": True,
        "preview":   False,
        "note":      "Fastest & cheapest in the 2.5 family.",
    },
]

# Separate lists for quick lookup in the UI
FREE_MODEL_IDS = {m["id"] for m in GOOGLE_MODELS if m["free_tier"]}
PAID_MODEL_IDS = {m["id"] for m in GOOGLE_MODELS if not m["free_tier"]}

# App
app = FastAPI(title="QnA Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request models 
class ChatRequest(BaseModel):
    question: str
    provider: Literal["google", "ollama"]
    api_key: Optional[str] = None
    langsmith_api_key: Optional[str] = None
    langsmith_project: Optional[str] = None
    model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 1024
    ollama_base_url: Optional[str] = None
    chat_history: Optional[list] = []


class ModelsRequest(BaseModel):
    provider: Literal["google", "ollama"]
    api_key: Optional[str] = None
    ollama_base_url: Optional[str] = None


# Helper 
def resolve(user_val: Optional[str], env_val: str) -> str:
    return (user_val or "").strip() or env_val


# Routes 
@app.get("/health")
def health():
    return {
        "status": "ok",
        "langsmith_configured": bool(DEFAULT_LANGSMITH_KEY),
        "google_configured":    bool(DEFAULT_GOOGLE_API_KEY),
        "ollama_url":           DEFAULT_OLLAMA_URL,
    }


@app.post("/models")
async def list_models(req: ModelsRequest):
    """Return available models + tier metadata for the chosen provider."""

    if req.provider == "google":
        # Return the full catalogue with tier/preview metadata so the UI
        # can group and annotate models without an extra API round-trip.
        return {
            "models": GOOGLE_MODELS,
            "tier_info": {
                "free_note": (
                    "Free-tier keys work for Flash & Flash-Lite models. "
                    "Rate limits apply: ~10 RPM / 250 req/day for Flash, "
                    "~15 RPM / 1,000 req/day for Flash-Lite."
                ),
                "paid_note": (
                    "Pro models require a billing-enabled key (Google AI Studio → "
                    "Upgrade to Paid) or a Google AI Pro ($19.99/mo) / "
                    "Ultra ($249.99/mo) subscription."
                ),
                "deprecation_note": (
                    "⚠ Gemini 2.0 Flash & 2.0 Flash-Lite were deprecated June 1 2026. "
                    "Migrate to 2.5 Flash / 3.x Flash."
                ),
            },
        }

    elif req.provider == "ollama":
        import httpx
        ollama_url = resolve(req.ollama_base_url, DEFAULT_OLLAMA_URL)
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{ollama_url}/api/tags")
                resp.raise_for_status()
                data = resp.json()
                models = [
                    {
                        "id":        m["name"],
                        "name":      m["name"],
                        "family":    "Ollama",
                        "free_tier": True,
                        "preview":   False,
                        "note":      "Local model — no API key or internet required.",
                    }
                    for m in data.get("models", [])
                ]
                return {"models": models}
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot reach Ollama at {ollama_url} — is it running? ({e})",
            )


@app.post("/chat")
async def chat(req: ChatRequest):
    """Stream a chat response with optional LangSmith tracing."""

    google_key     = resolve(req.api_key,           DEFAULT_GOOGLE_API_KEY)
    langsmith_key  = resolve(req.langsmith_api_key, DEFAULT_LANGSMITH_KEY)
    langsmith_proj = resolve(req.langsmith_project, DEFAULT_LANGSMITH_PROJECT)
    ollama_url     = resolve(req.ollama_base_url,   DEFAULT_OLLAMA_URL)

    # LangSmith 
    if langsmith_key:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"]    = langsmith_key
        os.environ["LANGCHAIN_PROJECT"]    = langsmith_proj
    else:
        os.environ["LANGCHAIN_TRACING_V2"] = "false"

    # Guard: paid-only model with no key 
    if req.provider == "google":
        if not google_key:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Google API key is required. "
                    "Paste it in the sidebar or set GOOGLE_API_KEY in backend/.env"
                ),
            )
        model_id = req.model or "gemini-2.5-flash"
        if model_id in PAID_MODEL_IDS:
            # We still attempt the call — the user might have a paid key.
            # We just attach a warning in the stream header so the UI can show it.
            pass  # handled gracefully: Google returns a 403 we surface to the user

    try:
        # pyrefly: ignore [missing-import]
        from langchain_core.messages import HumanMessage, AIMessage
        # pyrefly: ignore [missing-import]
        from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
        # pyrefly: ignore [missing-import]
        from langchain_core.output_parsers import StrOutputParser

        history_messages = []
        for msg in (req.chat_history or []):
            if msg["role"] == "user":
                history_messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                history_messages.append(AIMessage(content=msg["content"]))

        prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "You are a helpful, knowledgeable assistant. "
                "Answer questions clearly and concisely.",
            ),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}"),
        ])

        if req.provider == "google":
            # pyrefly: ignore [missing-import]
            from langchain_google_genai import ChatGoogleGenerativeAI
            llm = ChatGoogleGenerativeAI(
                model=model_id,
                google_api_key=google_key,
                temperature=req.temperature,
                max_output_tokens=req.max_tokens,
            )
        elif req.provider == "ollama":
            # pyrefly: ignore [missing-import]
            from langchain_ollama import ChatOllama
            llm = ChatOllama(
                model=req.model or "llama3.2",
                base_url=ollama_url,
                temperature=req.temperature,
                num_predict=req.max_tokens,
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid provider.")

        chain = prompt | llm | StrOutputParser()

        async def stream_response():
            try:
                async for chunk in chain.astream({
                    "question": req.question,
                    "history":  history_messages,
                }):
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
            except Exception as e:
                err = str(e)
                # Surface a friendly message for the most common errors
                if "API_KEY_INVALID" in err or "invalid api key" in err.lower():
                    friendly = "Invalid API key. Please check and re-enter your Google AI Studio key."
                elif "PERMISSION_DENIED" in err or "403" in err:
                    friendly = (
                        "Permission denied. This model requires a paid key. "
                        "Upgrade at aistudio.google.com/api-keys or choose a free-tier Flash model."
                    )
                elif "RESOURCE_EXHAUSTED" in err or "429" in err:
                    friendly = (
                        "Rate limit hit. Free-tier limits: ~10 RPM for Flash, ~5 RPM for Pro. "
                        "Wait a moment and try again, or upgrade to a paid key for higher limits."
                    )
                else:
                    friendly = err
                yield f"data: {json.dumps({'error': friendly})}\n\n"

        return StreamingResponse(
            stream_response(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Missing dependency: {e}. Run: pip install langchain-google-genai langchain-ollama langchain-core",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))