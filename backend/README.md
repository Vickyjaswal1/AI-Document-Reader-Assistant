# AI Document Chat — Backend

FastAPI backend for the AI Document Chat App. Upload a PDF or DOCX file and ask questions about it using a RAG pipeline powered by LangChain, ChromaDB, HuggingFace, and Groq.

---

## Tech Stack

- **FastAPI** — web framework
- **LangChain** — RAG pipeline orchestration
- **ChromaDB** — local vector database
- **HuggingFace** — embeddings model (all-MiniLM-L6-v2, runs locally, no API key needed)
- **Groq API** — LLM inference (LLaMA 3.3 70b, free tier)
- **Uvicorn** — ASGI server

---

## Project Structure

```
backend/
├── main.py           ← FastAPI app + all endpoints
├── requirements.txt  ← Python dependencies
├── .env              ← API keys (never push to GitHub)
├── .env.example      ← Template for .env
└── venv/             ← Virtual environment (never push to GitHub)
```

---

## Setup

**1. Create and activate virtual environment**
```bash
python -m venv venv
venv\Scripts\activate
```

**2. Install dependencies**
```bash
pip install -r requirements.txt
```

**3. Create .env file**
```
GROQ_API_KEY=your_groq_api_key_here
```

**4. Run the server**
```bash
uvicorn main:app --reload
```

Server runs at: `http://localhost:8000`

---

## API Endpoints

### GET /health
Health check — confirms server is running.

**Response:**
```json
{"status": "ok"}
```

---

### POST /upload
Upload a PDF or DOCX file. Chunks it, embeds it, stores in ChromaDB, and builds the RAG chain.

**Request:** multipart/form-data with a `file` field

**Response:**
```json
{"message": "File 'yourfile.pdf' uploaded and processed successfully."}
```

**Errors:**
- `400` — unsupported file type (only PDF and DOCX allowed)

---

### POST /ask
Ask a question about the uploaded document.

**Request:**
```json
{"question": "Who is Guts?"}
```

**Response:**
```json
{"answer": "Guts is the main protagonist of..."}
```

**Errors:**
- `400` — no document uploaded yet

---

## How It Works

1. User uploads a file via `/upload`
2. File is saved temporarily on the server
3. LangChain loads and splits the file into 500-character chunks (100 overlap)
4. HuggingFace embeds each chunk into vectors
5. Vectors are stored in ChromaDB with a unique collection name
6. A RAG chain is built: retriever → prompt → LLM
7. User asks a question via `/ask`
8. Question is embedded and matched against ChromaDB chunks
9. Top 3 matching chunks are passed to Groq (LLaMA 3.3 70b) as context
10. LLM generates an answer based only on the document context

---

## Notes

- The RAG chain is rebuilt every time a new file is uploaded
- The LLM is instructed to answer only from the document — it will say "I don't know based on the document" if the answer is not there
- CORS is configured to allow requests from `http://localhost:3000` (React frontend)
