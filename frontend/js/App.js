// frontend/js/App.js

class App {
  constructor() {
    console.log("App starting...");
    this.api = new ApiService("http://127.0.0.1:8000/api");

    this.graph = new GraphManager("cy", this.api);
    this.workspace = new IdeaWorkspace(this.api);
    this.settings = new SettingsModal(this.api);
    this.settings.currentSettings = {};

    // --- THIS IS THE CORRECT, COMPLETE LIST OF DOM REFS ---
    this.promptInput = document.getElementById("prompt-input");
    this.submitButton = document.getElementById("submit-button");
    this.loader = document.getElementById("loader");
    this.activeModelDisplay = document.getElementById("active-model-display");
    this.settingsButton = document.getElementById("settings-button");
    this.fileInput = document.getElementById("file-input");
    this.attachFileButton = document.getElementById("attach-file-button");
    this.filePreviewContainer = document.getElementById(
      "file-preview-container"
    );
    this.filePreviewImage = document.getElementById("file-preview-image");
    this.removeFileButton = document.getElementById("remove-file-button");
    this.attachedFilePath = null;
    // --- END OF FIX ---

    this._bindComponentEvents();
    this._bindUIEventListeners();
  }

  async init() {
    console.log("App.init: Starting initialization...");
    try {
      const settingsData = await this.api.getSettings();
      this.settings.currentSettings = settingsData;
      let availableModels = [];

      if (settingsData.gemini_api_key) {
        availableModels.push("gemini-1.5-flash-latest");
      }
      if (settingsData.runpod_url && settingsData.runpod_url.trim() !== "") {
        try {
          const ollamaData = await this.api.getOllamaModels();
          if (ollamaData.models) availableModels.push(...ollamaData.models);
        } catch (e) {
          console.warn("App.init: Could not connect to Ollama on startup.");
        }
      }

      this.workspace.setAvailableModels(availableModels);
      this.settings.availableModels = availableModels;
    } catch (error) {
      console.error("App.init: Failed to fetch initial settings.", error);
    }

    await this.graph.loadGraph();
    await this.updateActiveModelDisplay();
    console.log("App fully initialized and ready.");
  }

  _bindComponentEvents() {
    this.graph.onNodeClick((node) => this.workspace.open(node));
    this.workspace.onNodeDeletedCallback = () => this.graph.loadGraph();
    this.settings.onSettingsChangedCallback = () => this.onSettingsChanged();
  }

  _bindUIEventListeners() {
    this.submitButton.addEventListener("click", () => this.brainstormNewIdea());
    this.settingsButton.addEventListener("click", () => this.settings.open());
    this.attachFileButton.addEventListener("click", () =>
      this.fileInput.click()
    );
    this.removeFileButton.addEventListener("click", () =>
      this.resetFileUpload()
    );
    this.fileInput.addEventListener("change", (e) => this.handleFileUpload(e));
  }

  async onSettingsChanged() {
    console.log("App: Settings changed, re-initializing...");
    await this.init();
  }

  async brainstormNewIdea() {
    const promptText = this.promptInput.value;
    if (!promptText.trim() && !this.attachedFilePath) {
      alert("Please enter an idea or attach an image.");
      return;
    }
    this.loader.style.display = "block";
    this.submitButton.disabled = true;
    const currentAttachmentPath = this.attachedFilePath;
    const sourceNodeId = `node-user-${uuid_v4()}`;

    this.graph.addNode(
      {
        id: sourceNodeId,
        label: promptText || "Image Analysis",
        fullText: promptText,
        status: "Idea",
        attachment_path: currentAttachmentPath,
      },
      `user-node status-Idea ${currentAttachmentPath ? "has-attachment" : ""}`
    );
    try {
      const payload = {
        prompt: promptText,
        parent_context: null,
        source_node_id: sourceNodeId,
        attachment_path: currentAttachmentPath,
      };
      const data = await this.api.brainstorm(payload);
      this.graph.addNode(
        {
          id: data.ai_node.id,
          label: data.ai_node.label,
          fullText: data.ai_node.fullText,
          status: "Idea",
          attachment_path: currentAttachmentPath,
        },
        `ai-node status-Idea ${currentAttachmentPath ? "has-attachment" : ""}`
      );
      this.graph.addEdge({
        id: `edge-${sourceNodeId}-${data.ai_node.id}`,
        source: sourceNodeId,
        target: data.ai_node.id,
        label: promptText,
      });
      this.graph.rerunLayout();
    } catch (error) {
      console.error("App: Error in brainstorming process:", error);
      alert(error.message);
      this.graph.removeNodeById(sourceNodeId);
    } finally {
      this.loader.style.display = "none";
      this.submitButton.disabled = false;
      this.promptInput.value = "";
      this.resetFileUpload();
    }
  }

  async updateActiveModelDisplay() {
    try {
      const settingsData = await this.api.getSettings();
      const provider = settingsData.ai_provider || "gemini";
      let modelText =
        provider === "gemini"
          ? "Gemini"
          : settingsData.ollama_model_name || "Not Set";
      this.activeModelDisplay.textContent = `Active AI: ${modelText}`;
    } catch (error) {
      this.activeModelDisplay.textContent = `Active AI: Unknown`;
    }
  }

  resetFileUpload() {
    this.fileInput.value = "";
    this.attachedFilePath = null;
    this.filePreviewContainer.style.display = "none";
    this.attachFileButton.style.display = "block";
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.filePreviewImage.src = e.target.result;
      this.attachFileButton.style.display = "none";
      this.filePreviewContainer.style.display = "block";
    };
    reader.readAsDataURL(file);
    const formData = new FormData();
    formData.append("file", file);
    this.loader.style.display = "block";
    try {
      const data = await this.api.uploadFile(formData);
      this.attachedFilePath = data.filePath;
      console.log("App: File uploaded, path:", this.attachedFilePath);
    } catch (error) {
      console.error("App: Upload error:", error);
      alert("Failed to upload image.");
      this.resetFileUpload();
    } finally {
      this.loader.style.display = "none";
    }
  }
}

// --- GLOBAL HELPERS AND ENTRY POINT ---
function uuid_v4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function main() {
  await new Promise((resolve) =>
    document.addEventListener("DOMContentLoaded", resolve)
  );
  window.app = new App();
  await window.app.init();
}

main();
