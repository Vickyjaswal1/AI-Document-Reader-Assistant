import tempfile
import shutil
import uuid
import os

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
from pydantic import BaseModel  # BaseModel is from pydantic, not groq

from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import Docx2txtLoader, PyPDFLoader
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_community.chat_message_histories import ChatMessageHistory  # stores chat history per session

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# Load LLM — llama 3.3 70b via Groq API
llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model_name="llama-3.3-70b-versatile"
)

# Load HuggingFace embeddings — converts text chunks into vectors
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# Dictionary to store each user's rag_chain and chat history
# structure: { session_id: { "rag_chain": ..., "history": ChatMessageHistory } }
rag_sessions = {}

# Prompt template — tells LLM to use only document context and remember chat history
prompt = ChatPromptTemplate.from_template("""
You are a helpful assistant. Use ONLY the context below to answer the question.
If the answer is not in the context, say "I don't know based on the document."

Previous conversation:
{chat_history}

Context:
{context}

Question:
{question}

Answer:
""")

app = FastAPI()

# Allow React frontend on port 3000 to call this backend on port 8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/hello")
async def root():
    return {"message": "This my First AI App with FastAPI and React!"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):

    # Reject anything that is not a pdf or docx — message goes directly to frontend
    if not (file.filename.endswith(".pdf") or file.filename.endswith(".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported. Please upload a valid file.")

    # Save uploaded file temporarily to disk so loader can read it
    temp_path = os.path.join(tempfile.gettempdir(), file.filename)
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Pick the right loader based on file type
    if file.filename.endswith(".pdf"):
        loader = PyPDFLoader(temp_path)
    else:
        loader = Docx2txtLoader(temp_path)

    # Load the file content as LangChain documents
    documents = loader.load()

    # Split document into small chunks so embeddings work accurately
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    chunks = splitter.split_documents(documents)

    # Store chunks in ChromaDB as vectors — each upload gets a unique collection
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name="doc_" + str(uuid.uuid4())[:8]  # unique name to avoid conflicts
    )

    # Retriever fetches top 3 most relevant chunks for a given question
    retriever = vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 3})

    # Build RAG chain — takes dict input {question, chat_history} and returns LLM response
    rag_chain = (
        {
            "context": lambda x: retriever.invoke(x["question"]),   # fetch relevant chunks using question
            "question": lambda x: x["question"],                    # pass question to prompt
            "chat_history": lambda x: x["chat_history"],            # pass formatted history to prompt
        }
        | prompt
        | llm
    )

    # Generate unique session_id for this upload
    session_id = str(uuid.uuid4())

    # Store rag_chain and fresh empty history together under this session_id
    rag_sessions[session_id] = {
        "rag_chain": rag_chain,
        "history": ChatMessageHistory()  # empty on upload, grows as user asks questions
    }

    # Return success message + session_id — frontend stores session_id for all future /ask calls
    return {
        "message": f"'{file.filename}' uploaded and processed successfully. You can now ask questions.",
        "session_id": session_id
    }


class QuestionRequest(BaseModel):
    question: str
    session_id: str  # frontend must send this with every question


@app.post("/ask")
async def ask_question(request: QuestionRequest):

    # Look up session by session_id — if not found, session is invalid or expired
    session = rag_sessions.get(request.session_id)

    # This message goes directly to frontend via error.response.data.detail
    if session is None:
        raise HTTPException(status_code=400, detail="Invalid or expired session. Please upload a document first.")

    rag_chain = session["rag_chain"]
    history = session["history"]

    # Format past messages as plain text so LLM can read conversation history
    # history.messages is a list of HumanMessage and AIMessage objects
    # on first question this is an empty string — grows after each turn
    formatted_history = "\n".join(
        f"{'User' if msg.type == 'human' else 'Assistant'}: {msg.content}"
        for msg in history.messages
    )

    # Invoke chain with question and formatted history
    response = rag_chain.invoke({
        "question": request.question,
        "chat_history": formatted_history
    })

    # Save this turn to history so next question can reference it
    history.add_user_message(request.question)
    history.add_ai_message(response.content)

    return {"answer": response.content}


# Delete session endpoint — frees memory and cleans up ChromaDB collection
# Frontend calls this when user clicks Reset or uploads a new document
@app.delete("/session/{session_id}")
async def delete_session(session_id: str):

    # This message goes directly to frontend via error.response.data.detail
    if session_id not in rag_sessions:
        raise HTTPException(status_code=404, detail="Session not found. It may have already been deleted.")

    # Remove session — rag_chain and history both get garbage collected
    del rag_sessions[session_id]

    return {"message": "Session deleted successfully. Upload a new document to start over."}


@app.get("/health")
def health():
    return {"status": "ok"}