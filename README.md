# AI Brainstorming Canvas

A powerful, interactive brainstorming tool that combines a visual graph workspace with a multi-agent AI meeting board. This application empowers users to explore ideas, generate sub-concepts, and convene a board of AI experts to discuss topics, critique ideas, and provide diverse perspectives.

## 🚀 Key Features

### 1. 🧠 Visual Idea Graph
*   **Interactive Canvas:** Visualize your thoughts as a dynamic network of nodes using Cytoscape.js.
*   **AI-Powered Expansion:** "Explode" any idea node to automatically generate related sub-concepts and connections using AI.
*   **Multimedia Nodes:** Create nodes from text prompts or uploaded images.
*   **Inspector Mode:** View and edit the full content of any node.
*   **Flexible Layouts:** Switch between Force-Directed and Grid layouts to organize your thoughts.

### 2. 👥 Interactive Meeting Board
*   **Assemble Your Dream Team:** Select from a diverse roster of AI personas (e.g., Steve Jobs, Elon Musk, Yoda, Skeptic, Optimist) to participate in your brainstorming session.
*   **Context-Aware Discussions:** Define the meeting topic and company background to guide the AI agents.
*   **Turn-Based Interaction:** Watch agents discuss the topic, offering unique insights based on their defined personas.
*   **User Participation:** Intervene in the meeting at any time! Ask follow-up questions, clarify points, or steer the conversation using the integrated chat.
*   **Real-Time Feedback:** Visual "Thinking..." bubbles show when agents are formulating their responses.

### 3. 📝 Meeting Minutes & AI Secretary
*   **Automated Minutes:** Generate comprehensive, structured meeting minutes with a single click at the end of a session.
*   **Promote to Graph:** Instantly convert meeting minutes into a new node on your brainstorming canvas to keep the workflow seamless.
*   **AI Secretary Chat:** Query a dedicated AI Secretary about the meeting details, decisions, or specific agent quotes.
*   **Export:** Download minutes as Markdown files for external use.

### 4. 🤖 Hybrid AI Engine
*   **Dual Model Support:** Seamlessly integrates **Google Gemini** (Cloud) and **Ollama** (Local) models.
*   **Flexible Configuration:** Choose different models for different tasks (e.g., use a fast local model for simple chat and a powerful cloud model for complex reasoning).

## 📂 Project Structure

```text
brainstorming_app/
├── backend/                        # FastAPI Backend
│   ├── config.py                   # Configuration settings
│   ├── main.py                     # Application entry point
│   ├── schemas.py                  # Pydantic data models
│   ├── requirements.txt            # Python dependencies
│   ├── data_access/                # Database connection logic
│   │   └── connection.py
│   ├── repositories/               # Data access layers
│   │   ├── chat_repository.py
│   │   ├── graph_repository.py
│   │   └── settings_repository.py
│   ├── routers/                    # API Endpoints
│   │   ├── chat.py
│   │   ├── files.py
│   │   ├── graph.py
│   │   ├── meeting.py              # Meeting Board logic
│   │   ├── ollama.py
│   │   └── settings.py
│   └── services/                   # Business logic
│       ├── chat_service.py
│       ├── graph_service.py
│       ├── llm_service.py          # AI integration (Gemini/Ollama)
│       └── settings_service.py
├── frontend/                       # Vanilla JS Frontend
│   ├── index.html                  # Main application interface
│   ├── style.css                   # Global styles
│   └── js/
│       ├── App.js                  # Main application controller
│       ├── components/
│       │   ├── GraphManager.js     # Cytoscape graph handling
│       │   ├── IdeaWorkspace.js    # Workspace logic
│       │   └── SettingsModal.js    # Settings UI
│       └── services/
│           └── ApiService.js       # Frontend API client
├── brainstorm.db                   # SQLite Database
├── requirements.txt                # Project root dependencies
└── README.md                       # Project documentation
```

## 🛠️ Technology Stack

*   **Frontend:** HTML5, CSS3, JavaScript (ES6+), Cytoscape.js, Tippy.js
*   **Backend:** Python 3.x, FastAPI, Pydantic, SQLite
*   **AI Models:** Google Gemini Pro/Flash, Ollama (Llama 3, Mistral, etc.)

## ⚡ Getting Started

1.  **Backend Setup:**
    ```bash
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload
    ```

2.  **Frontend Setup:**
    *   Serve the `frontend` directory using any static file server (e.g., Live Server in VS Code).
    *   Or use a local server (e.g., Python's built-in HTTP server):
        ```bash
        cd brainstorming_app
        python -m http.server 5500 --directory frontend
        ```

3.  **Configuration:**
    *   Open the app and click the **Settings (⚙️)** icon.
    *   Configure your Google API Key and select your preferred Ollama models.
