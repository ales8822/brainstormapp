

# AI Brainstorming Canvas

Welcome to the AI Brainstorming Canvas, a Python-based application designed to take your ideas from a simple spark to a fully structured project. This tool evolves beyond traditional mind maps by integrating a hierarchical system of visual canvases with a powerful, multimodal AI chat, allowing you to explore, connect, and manage your thoughts in a focused and persistent environment.

*(Suggestion: Take a new screenshot showing the workspace view with the inspector, canvas, and chat panels, upload it to a site like Imgur, and paste the link here.)*
``

---

## ✨ Features

This application has been significantly refactored to support a more organized and powerful workflow.

*   **Hierarchical Canvas System:**
    *   **Overview Canvas:** A top-level space to create and organize your main "Ideas" as distinct nodes.
    *   **Workspace Canvas:** Double-click any Idea Node to enter a dedicated, infinite canvas. This is your focused environment for developing that single idea.
    *   **Breadcrumb Navigation:** A clear breadcrumb (`Home / Your Idea Name`) at the top of the workspace allows for easy navigation back to the overview.

*   **Advanced Workspace Functionality:**
    *   **Multimodal Chat:** Engage in a rich conversation with an AI assistant on the right-hand panel. Use text or upload images for the AI to analyze and discuss.
    *   **"Sticky" Image Context:** An uploaded image remains as the context for the entire conversation, being sent with every subsequent prompt until you manually remove it.
    *   **Promote to Node:** Instantly convert any AI or user message from the chat into a new, persistent node on the workspace canvas with a single click.
    *   **Manual Edge Creation:** Visually connect related nodes within the workspace. Hovering over a node reveals a `+` button; click it and then click another node to draw a persistent edge between them.
    *   **Full Graph CRUD:** A complete set of tools for graph management.
        *   **Create:** Promote chat messages to create nodes.
        *   **Connect:** Manually draw edges between nodes.
        *   **Delete:** Select any node or edge and press the `Delete` or `Backspace` key to remove it permanently (with confirmation for nodes).

*   **Persistent Node Inspector:**
    *   **Editable Content:** Click any node in the workspace to open the Inspector panel on the left. You can view and edit the node's full text content and save your changes.
    *   **Lifecycle Tracking:** Change the status of any node (`Idea`, `In Progress`, `Completed`, `Archived`) using color-coded buttons in the inspector. The changes are saved and reflected on the node's color.
    *   **Image Display:** If a node was created from an image-based chat message, the associated image is displayed directly in the inspector panel.

*   **Robust & Modern Architecture:**
    *   **Stateful Routing:** The app uses URL hashes (`#/workspace/:id`) to remember your position. You can refresh the page and land exactly where you left off, whether in the overview or a specific workspace.
    *   **Persistent Storage:** All ideas, workspace nodes, edges, and their statuses are automatically saved to a local SQLite database.
    *   **Dynamic AI Configuration:** A full settings panel allows for switching between AI providers (Google Gemini, Custom Ollama/RunPod endpoints) and managing API keys on the fly.

## 🛠️ Technology Stack

*   **Backend:**
    *   **Framework:** **FastAPI** (fully `async`)
    *   **Architecture:** **Service Layer + Repository Pattern**
    *   **Database:** **SQLite** with `aiosqlite` for non-blocking access.
*   **Frontend:**
    *   **Structure:** Vanilla JavaScript with a modern Object-Oriented (OOP) class-based design.
    *   **Visualization:** **Cytoscape.js** for the interactive graph canvases.
    *   **UI Components:** **Tippy.js** for interactive node tooltips.

## 🚀 Getting Started

Follow these steps to get the application running on your local machine.

### Prerequisites

*   Python 3.10+
*   An active Google Gemini API Key (get one from [Google AI Studio](https://aistudio.google.com/app/apikey)).
*   (Optional) An instance of [Ollama](https://ollama.com/) running.

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd brainstorming-app
```

### 2. Set Up the Backend
```bash
# Create and activate a Python virtual environment
python -m venv venv
# On Windows: .\venv\Scripts\activate
# On macOS/Linux: source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 3. Configure Environment Variables
In the root `brainstorming-app` directory, create a file named `.env` and add your API key.
```dotenv
# .env
GOOGLE_API_KEY="your_google_api_key_here"
```

### 4. Run the Application
You need to run two servers in two separate terminals from the root project directory.

**Terminal 1: Start the Backend (FastAPI)**
```bash
# (Make sure your virtual environment is active and you are in root directory, the server will run the app from backend/ folder)
uvicorn backend.main:app 
```
The API server will start on `http://127.0.0.1:8000`.

**Terminal 2: Start the Frontend (Web Server)**
```bash
python -m http.server 5500 --directory frontend
```

### 5. Access the Application
Open your web browser and navigate to:
**`http://127.0.0.1:5500`**

## 📂 Project Structure

```
brainstorming-app/
├── .env
├── README.md
├── run.py                # Main script to run the backend
├── venv/
│
├── backend/
│   ├── config.py           # Centralized configuration
│   ├── main.py             # FastAPI app assembly
│   ├── schemas.py          # Pydantic data models
│   ├── dependencies.py     # FastAPI dependency injection
│   │
│   ├── data_access/
│   │   └── connection.py   # Database initialization and schema
│   │
│   ├── repositories/       # REPOSITORY LAYER (Data Access)
│   │   ├── chat_repository.py
│   │   └── graph_repository.py
│   │
│   ├── services/           # SERVICE LAYER (Business Logic)
│   │   ├── chat_service.py
│   │   ├── graph_service.py
│   │   └── llm_service.py
│   │
│   ├── routers/            # ROUTER LAYER (API Endpoints)
│   │   ├── chat.py
│   │   ├── files.py
│   │   └── graph.py
│   │
│   └── requirements.txt
│
└── frontend/
    ├── js/
    │   ├── components/
    │   │   ├── GraphManager.js
    │   │   ├── IdeaWorkspace.js
    │   │   └── SettingsModal.js
    │   │
    │   ├── services/
    │   │   └── ApiService.js
    │   │
    │   └── App.js          # Main application class and logic
    │
    ├── uploads/            # Directory for uploaded images
    ├── index.html
    └── style.css
```
