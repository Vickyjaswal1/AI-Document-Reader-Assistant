import { useState, useRef, useEffect } from "react"; // ✅ added useRef and useEffect for auto-scroll
import axios from "axios";
import AnimatedBackground from "./comps/AnimatedBackground";

function App() {
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]); // ✅ NEW: stores all Q&A as array of {role, content}

  const chatEndRef = useRef(null); // ✅ NEW: ref attached to bottom of chat — used to auto-scroll

  // ✅ NEW: runs every time chatHistory changes — scrolls to latest message automatically
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await axios.post("http://localhost:8000/upload", formData);

      setMessage(response.data.message); // success message from backend
      setSessionId(response.data.session_id); // store session_id for /ask calls
      setChatHistory([]); // ✅ NEW: clear chat thread when new document is uploaded

    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async () => {
    if (!question) {
      setError("Please type a question first.");
      return;
    }

    // ✅ NEW: immediately add user message to chat thread so it shows instantly
    const userMessage = { role: "user", content: question };
    setChatHistory((prev) => [...prev, userMessage]);
    setQuestion(""); // clear input right away
    setError("");
    setMessage("");

    try {
      setLoading(true);

      const response = await axios.post("http://localhost:8000/ask", {
        question: userMessage.content,
        session_id: sessionId,
      });

      // ✅ NEW: add AI response to chat thread after backend replies
      const aiMessage = { role: "ai", content: response.data.answer };
      setChatHistory((prev) => [...prev, aiMessage]);

    } catch (err) {
      // ✅ NEW: add error as a special chat message so it shows inside the thread
      const errorMessage = {
        role: "error",
        content: err.response?.data?.detail || "Something went wrong. Please try again."
      };
      setChatHistory((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: allow user to press Enter key to ask instead of clicking Ask button
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading && sessionId) {
      handleAsk();
    }
  };

  const handleReset = async () => {
    if (sessionId) {
      try {
        const response = await axios.delete(`http://localhost:8000/session/${sessionId}`);
        setMessage(response.data.message); // "Session deleted successfully..."
      } catch (err) {
        setError(err.response?.data?.detail || "Something went wrong. Please try again.");
      }
    }

    // clear all state
    setSessionId(null);
    setFile(null);
    setQuestion("");
    setChatHistory([]); // ✅ NEW: clear chat thread on reset
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-6 transition-colors duration-300 relative overflow-hidden">

      <AnimatedBackground />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg w-full max-w-2xl p-8 transition-colors duration-300 relative z-10">

        {/* Top bar */}
        <div className="flex justify-between mb-6">
          {sessionId && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-4 py-2 rounded-full text-sm font-medium transition hover:bg-red-200"
            >
              🔄 Reset
            </button>
          )}
          <button
            onClick={toggleDarkMode}
            className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2 rounded-full text-sm font-medium transition ml-auto"
          >
            {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
        </div>

        <h1 className="text-3xl font-bold text-center text-blue-600 dark:text-blue-400 mb-8">
          AI Document Reader & Assistant
        </h1>

        {/* UPLOAD SECTION */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Upload a Document
          </h2>
          <div className="flex gap-3">
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => setFile(e.target.files[0])}
              className="flex-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg p-2 text-sm"
            />
            <button
              onClick={handleUpload}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Upload
            </button>
          </div>
          {sessionId && file && (
            <p className="text-sm text-green-500 mt-2">✅ {file.name} ready</p>
          )}
        </div>

        {/* SUCCESS MESSAGE */}
        {message && <p className="text-sm text-green-500 mb-4">{message}</p>}

        {/* ERROR MESSAGE */}
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        {/* ✅ NEW: CHAT THREAD — only shows after at least one message exists */}
        {chatHistory.length > 0 && (
          <div className="mb-6 max-h-96 overflow-y-auto flex flex-col gap-3 pr-1">
            {/* max-h-96 limits height, overflow-y-auto adds scroll when messages overflow */}

            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start" // user right, AI left
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-none"           // user bubble — blue, right
                      : msg.role === "ai"
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none" // AI bubble — grey, left
                      : "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-bl-none"     // error bubble — red, left
                  }`}
                >
                  {/* small label above each bubble showing who sent it */}
                  <p className="text-xs font-semibold mb-1 opacity-70">
                    {msg.role === "user" ? "You" : msg.role === "ai" ? "AI" : "Error"}
                  </p>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* ✅ NEW: loading bubble — shows while waiting for AI response */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-2xl rounded-bl-none text-sm">
                  <p className="text-xs font-semibold mb-1 opacity-70">AI</p>
                  Thinking...
                </div>
              </div>
            )}

            {/* ✅ NEW: invisible div at bottom — scrollIntoView targets this to scroll chat down */}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* ASK SECTION */}
        <div className="mb-2">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={sessionId ? "Type your question here..." : "Upload a document first..."}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown} // ✅ NEW: press Enter to ask
              disabled={!sessionId}     // ✅ input also disabled until document uploaded
              className="flex-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg p-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleAsk}
              disabled={!sessionId || loading}
              className={`px-4 py-2 rounded-lg text-white transition ${
                sessionId && !loading
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              Ask
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;