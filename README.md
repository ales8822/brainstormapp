# AI Brainstorming Canvas

Welcome to the AI Brainstorming Canvas, a revolutionary Python-based application designed to visualize and develop ideas. This tool goes beyond traditional mind maps by integrating a powerful, interactive visual graph with multi-agent AI conversations, allowing you to explore, expand, and track your ideas from inception to completion.

![Application Screenshot](https://i.imgur.com/your-screenshot-url.png) 
*(Suggestion: Take a great screenshot of your app in action, upload it to a site like Imgur, and paste the link here.)*

---

## ✨ Features

*   **Visual Idea Graph:** Create ideas as nodes on an infinite canvas. Connect them to build out complex thought trees and visualize relationships.
*   **Multimodal Brainstorming:** Start new ideas with just text, or upload an **image** to have the AI analyze and discuss it with you.
*   **Multi-Agent AI Roundtable:** Engage in a **group chat** with multiple AI models simultaneously. Add, remove, and direct messages to participants like Google Gemini and various open-source models (via Ollama) in the same conversation.
*   **Persistent Chat History:** Every node has its own dedicated "Idea Workspace" with a persistent chat history, saved to a local database. Pick up any conversation right where you left off.
*   **Idea Lifecycle Tracking:** Mark the status of any idea (`Idea`, `In Progress`, `Completed`, `Archived`) with clear, color-coded visual indicators.
*   **Dynamic Provider Switching:** A full-featured settings panel allows you to switch between different AI providers, manage API keys, and configure custom endpoints on the fly.
*   **Model Provenance:** The application tracks and displays exactly which AI model generated each node and each chat message, providing a clear audit trail of your creative process.

## 🛠️ Technology Stack

This project is a full-stack application built with a modern Python and JavaScript architecture.

*   **Backend:**
    *   **Framework:** **FastAPI** (`async`)
    *   **AI Integration:** Google Generative AI (`gemini`), **Ollama**
    *   **Database:** **SQLite** (for simple, file-based persistence)
    *   **Async HTTP:** `httpx`
*   **Frontend:**
    *   **Structure:** Vanilla JavaScript with a modern **Object-Oriented (OOP)** class-based design (`ApiService`, `GraphManager`, `IdeaWorkspace`, etc.).
    *   **Visualization:** **Cytoscape.js** for the interactive graph canvas.
    *   **File Serving:** Simple Python `http.server` for development.

## 🚀 Getting Started

Follow these steps to get the application running on your local machine.

### Prerequisites

*   Python 3.10+
*   An active Google Gemini API Key (get one from [Google AI Studio](https://aistudio.google.com/app/apikey)).
*   (Optional) An instance of [Ollama](https://ollama.com/) running, either locally or on a service like [RunPod](https://runpod.io), with at least one model pulled (e.g., `ollama pull llama3`).

### 1. Clone the Repository

    ```bash
    git clone <your-repository-url>
    cd brainstorming_app
    
2. Set Up the Backend
    The backend runs the API server and connects to the database and AI services.
    code
    Bash
    # Navigate to the backend folder
    cd backend

    # Create a Python virtual environment
    python -m venv venv

    # Activate the virtual environment
    # On Windows (PowerShell):
    .\venv\Scripts\activate
    # On macOS/Linux:
    source venv/bin/activate

    # Install the required Python packages
    pip install -r requirements.txt

3. Configure Environment Variables
    In the root brainstorming_app directory, create a file named .env.
    Add your Google Gemini API key to this file. The Ollama/RunPod URL is optional and can be configured later in the app's UI.
    code
    Dotenv
    # .env
    GOOGLE_API_KEY="AIza..."

4. Run the Application
    You need to run two servers in two separate terminals from the root brainstorming_app directory.
    Terminal 1: Start the Backend (API Server)
    Make sure your virtual environment is active.
    code
    Bash
    # From the root project directory
    python run.py
    This will start the FastAPI server on http://127.0.0.1:8000.
    Terminal 2: Start the Frontend (Web Server)
    code
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
    Enter the base URL of your running Ollama instance (e.g., http://localhost:11434 or a RunPod URL).
    Click the "Refresh" button (🔄) to fetch the list of available models you have pulled.
    Select a default model from the dropdown.
    Click "Save Settings".