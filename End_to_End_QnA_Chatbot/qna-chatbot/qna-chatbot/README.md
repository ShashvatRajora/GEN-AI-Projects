QnA Chatbot — LangChain + LangSmith + Google Gemini / Ollama
 
A full-stack, end-to-end QnA chatbot with:
- **Google AI Studio (Gemini)** or **Ollama** (local) as LLM backends
- **LangSmith** tracing & monitoring for every request
- Beautiful **React web UI** with per-user API keys, model selector, temperature & max-token controls
- **Streaming** responses (SSE)
- **Multi-turn** conversation history
---
 
## 📁 Project Structure
 
```
qna-chatbot/
├── backend/
│   ├── main.py            # FastAPI server (LangChain chains, streaming, LangSmith)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── start.sh
├── frontend/
│   ├── src/
│   │   ├── App.js         # React chat UI
│   │   └── App.css
│   ├── public/index.html
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```
 
---
 
## Quick Start
 
### Option A — Manual (Development)
 
#### 1. Backend
 
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
 
#### 2. Frontend
 
```bash
cd frontend
npm install
npm start         
```
 
---
 
### Option B — Docker Compose
 
```bash
docker-compose up --build
```
 
- Frontend → http://localhost:3000  
- Backend  → http://localhost:8000
---
 
##  Configuration (in the UI sidebar)
 
| Setting | Description |
|---------|-------------|
| **Provider** | Switch between Google AI Studio or Ollama |
| **Google AI Studio Key** | Get from https://aistudio.google.com/app/apikey |
| **Ollama Base URL** | Default `http://localhost:11434` (must have Ollama running) |
| **LangSmith API Key** | Optional — enables full tracing. Get from https://smith.langchain.com |
| **LangSmith Project** | Logical grouping for traces (default: `qna-chatbot`) |
| **Model** | Auto-fetched from your provider |
| **Temperature** | 0 = deterministic, 1 = creative |
| **Max Tokens** | Max response length (128–4096) |
 
---
 
## Using Ollama (Local Models)
 
1. Install Ollama: https://ollama.com/download
2. Pull a model:
   ```bash
   ollama pull llama3.2
   ollama pull mistral
   ollama pull gemma2
   ```
3. Start Ollama (it auto-starts on most systems)
4. In the UI: select **Ollama**, set base URL to `http://localhost:11434`, click **Refresh** to load models
---
 
## Using Google AI Studio (Gemini)
 
1. Get a free API key: https://aistudio.google.com/app/apikey
2. In the UI: select **Google AI**, paste your key
3. Models load automatically 
---
 
## LangSmith Monitoring
 
1. Sign up at https://smith.langchain.com (free tier available)
2. Create a project (e.g. `qna-chatbot`)
3. Get your API key from **Settings → API Keys**
4. Paste it in the sidebar — every chat request will be traced
5. Click the **View in LangSmith** link in the sidebar to see live traces
Each trace shows:
- Full prompt + system message
- Model parameters (temperature, max_tokens)
- Input/output tokens
- Latency
- Error details (if any)
---
 
##  API Endpoints
 
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/models` | List available models for a provider |
| POST | `/chat` | Stream a chat response (SSE) |
 
### POST /chat — Request Body
 
```json
{
  "question": "What is LangSmith?",
  "provider": "google",
  "api_key": "AIza...",
  "langsmith_api_key": "ls__...",
  "langsmith_project": "qna-chatbot",
  "model": "gemini-2.0-flash",
  "temperature": 0.7,
  "max_tokens": 1024,
  "chat_history": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi! How can I help?"}
  ]
}
```
 
---
 
## Security Notes
 
- API keys are **never stored** — they live in browser memory only and are sent per-request
- For production, set up HTTPS and consider a backend session/key-management layer
- CORS is open (`*`) by default — restrict in production
---
 
## Tech Stack
 
| Layer | Technology |
|-------|-----------|
| LLM Orchestration | LangChain Core |
| Google LLM | langchain-google-genai (Gemini) |
| Local LLM | langchain-ollama |
| Monitoring | LangSmith |
| Backend | FastAPI + Uvicorn |
| Streaming | Server-Sent Events (SSE) |
| Frontend | React 18 |
| Markdown | react-markdown + remark-gfm |
| Icons | Lucide React |
| Fonts | Syne + JetBrains Mono |
 
---
 
##  Production Deployment
 
### Architecture
 
```
User → Vercel (React frontend) → Railway/Render (FastAPI backend) → Google AI / Ollama
                                         ↓
                                    LangSmith (tracing)
```
 
---
 
 
### Environment Variables Reference
 
#### Backend (Railway / Render)
 
| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | If using Google AI | From aistudio.google.com |
| `LANGCHAIN_API_KEY` | Optional | From smith.langchain.com |
| `LANGCHAIN_PROJECT` | Optional | LangSmith project name |
| `LANGCHAIN_TRACING_V2` | Optional | `true` to enable tracing |
| `OLLAMA_BASE_URL` | If using Ollama | URL of your Ollama instance |
| `ALLOWED_ORIGINS` | Yes (prod) | Your Vercel frontend URL |
 
#### Frontend (Vercel)
 
| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_URL` | Yes | Your Railway/Render backend URL |
