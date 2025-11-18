# AI Brainstorming Canvas

Welcome to the AI Brainstorming Canvas, a revolutionary Python-based application designed to visualize and develop ideas. This tool goes beyond traditional mind maps by integrating a powerful, interactive visual graph with multi-agent AI conversations, allowing you to explore, expand, and track your ideas from inception to completion.

![Application Screenshot](https://i.imgur.com/your-screenshot-url.png) 
*(Suggestion: Take a great screenshot of your app in action, upload it to a site like Imgur, and paste the link here.)*

---

## ✨ Features

*   **Visual Idea Graph:** Create ideas as nodes on an infinite canvas. Connect them to build out complex thought trees and visualize relationships.
*   **Multimodal Brainstorming:** Start new ideas with just text, or upload an **image** for the AI to analyze and discuss.
*   **True Asynchronous Multi-Agent Chat:** Engage in a real-time group chat with multiple AI models simultaneously. Responses stream in as they become available, thanks to a fully asynchronous backend.
*   **Persistent Chat History:** Every node has its own dedicated "Idea Workspace" with a persistent chat history, saved to a local SQLite database.
*   **Idea Lifecycle Tracking:** Mark the status of any idea (`Idea`, `In Progress`, `Completed`, `Archived`) with clear, color-coded visual indicators.
*   **Dynamic Provider Switching:** A full-featured settings panel allows you to switch between different AI providers, manage API keys, and configure custom endpoints on the fly.
*   **Model Provenance:** The application tracks and displays exactly which AI model generated each node and each chat message.

## 🛠️ Technology Stack & Architecture

This project is a full-stack application built with a modern, asynchronous, and object-oriented architecture.

*   **Backend:**
    *   **Framework:** **FastAPI** (fully `async`)
    *   **Architecture:** **Service Layer + Repository Pattern** for clear separation of concerns.
    *   **Database:** **SQLite** with the **`aiosqlite`** driver for non-blocking database access.
    *   **Concurrency:** Robust handling of concurrent requests using `asyncio.Lock` to ensure thread-safe database writes.
    *   **AI Integration:** Google Generative AI (`gemini`), **Ollama**
    *   **Async HTTP:** `httpx` for all external API calls.
*   **Frontend:**
    *   **Structure:** Vanilla JavaScript with a modern **Object-Oriented (OOP)** class-based design.
    *   **Visualization:** **Cytoscape.js** for the interactive graph canvas.
    *   **File Serving:** Simple Python `http.server` for development.

## 🏗️ Architectural Refactor

The backend was recently refactored from a procedural style to a robust, object-oriented **Service Layer** and **Repository Pattern**. This major overhaul was undertaken to:
- **Improve Maintainability:** By separating business logic (Services) from data access (Repositories), the codebase is now significantly easier to understand, debug, and extend.
- **Enhance Performance & Stability:** The entire backend was converted to be fully asynchronous, from API endpoints down to the database. This involved:
    - Migrating from `sqlite3` to `aiosqlite` to prevent I/O blocking.
    - Implementing `async/await` throughout the entire call stack.
    - Using `fastapi.concurrency.run_in_threadpool` to safely handle synchronous third-party libraries.
- **Solve Concurrency Issues:** Critical bugs related to SQLite's `database is locked` errors during concurrent streaming were resolved by adopting a per-operation connection model and using `asyncio.Lock` for all database writes.

## 🚀 Getting Started

Follow these steps to get the application running on your local machine.

### Prerequisites

*   Python 3.10+
*   An active Google Gemini API Key (get one from [Google AI Studio](https://aistudio.google.com/app/apikey)).
*   (Optional) An instance of [Ollama](https://ollama.com/) running, with at least one model pulled (e.g., `ollama pull llama3`).


### 1. Clone the Repository
    ```bash
    git clone <your-repository-url>
    cd brainstorming_app

2. Set Up the Backend
    The backend runs the API server and connects to the database and AI services.
    
    Bash
    # Create a Python virtual environment in the root directory
    python -m venv venv

    # Activate the virtual environment
    # On Windows (PowerShell):
    .\venv\Scripts\activate
    # On macOS/Linux:
    source venv/bin/activate

    # Install the required Python packages
    pip install -r backend/requirements.txt

3. Configure Environment Variables
    In the root brainstorming_app directory, create a file named .env. Add your Google Gemini API key to this file.
    
    Dotenv
    # .env
    GOOGLE_API_KEY="AIza..."
4. Run the Application
    You need to run two servers in two separate terminals from the root brainstorming_app directory.
    Terminal 1: Start the Backend (API Server)
    (Make sure your virtual environment is active)
    
    Bash
    # From the root project directory
    python run.py
    This will start the FastAPI server on http://127.0.0.1:8000.
    Terminal 2: Start the Frontend (Web Server)
    
    Bash
    # From the root project directory
    python -m http.server 5500 --directory frontend
    This will start a simple web server for the user interface.
5. Access the Application
    Open your web browser and navigate to:
    http://127.0.0.1:5500
    You should see the AI Brainstorming Canvas, ready to use!
    ⚙️ Configuration
    Click the gear icon (⚙️) in the bottom-left corner to open the Settings modal.
    Google Gemini: Ensure the API key is entered here if you didn't use the .env file.
    Custom Endpoint (Ollama/RunPod):
    Select "Custom Endpoint" from the provider dropdown.
    Enter the base URL of your running Ollama instance (e.g., http://localhost:11434).
    Click the "Refresh" button (🔄) to fetch the list of available models.
    Select a default model from the dropdown.
    Click "Save Settings".


📂 New Project Structure
    The refactored backend now has a clear and maintainable structure.

    brainstorming_app/
    ├── .env
    ├── .gitignore
    ├── README.md
    ├── run.py                # Main script to run the backend
    ├── venv/                   # Python virtual environment
    │
    ├── backend/
    │   ├── __init__.py
    │   ├── config.py           # Centralized configuration (paths, keys)
    │   ├── main.py             # FastAPI app assembly and lifespan events
    │   ├── schemas.py          # Pydantic data models
    │   ├── dependencies.py     # FastAPI dependency injection providers
    │   │
    │   ├── data_access/
    │   │   └── connection.py   # Manages DB initialization
    │   │
    │   ├── repositories/       # REPOSITORY LAYER (Data Access)
    │   │   ├── chat_repository.py
    │   │   ├── graph_repository.py
    │   │   └── settings_repository.py
    │   │
    │   ├── services/           # SERVICE LAYER (Business Logic)
    │   │   ├── chat_service.py
    │   │   ├── graph_service.py
    │   │   ├── llm_service.py
    │   │   └── settings_service.py
    │   │
    │   ├── routers/            # ROUTER LAYER (API Endpoints)
    │   │   ├── chat.py
    │   │   ├── files.py
    │   │   ├── graph.py
    │   │   ├── ollama.py
    │   │   └── settings.py
    │   │
    │   └── requirements.txt
    │
    └── frontend/
        ├── js/
        ├── uploads/
        ├── index.html
        └── style.css