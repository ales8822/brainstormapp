// frontend/js/App.js

class App {
  constructor() {
    console.log("App starting...");
    this.api = new ApiService("http://127.0.0.1:8000/api");

    // --- Initialize Components ---
    this.graph = new GraphManager("cy", this.api);
    this.workspace = new IdeaWorkspace(this.api);
    this.settings = new SettingsModal(this.api);

    // --- DOM Element References for Main Controls ---
    this.promptInput = document.getElementById("prompt-input");
    this.submitButton = document.getElementById("submit-button");
    this.loader = document.getElementById("loader");
    this.activeModelDisplay = document.getElementById("active-model-display");
    this.settingsButton = document.getElementById("settings-button");

    // Image upload refs
    this.fileInput = document.getElementById("file-input");
    this.attachFileButton = document.getElementById("attach-file-button");
    this.filePreviewContainer = document.getElementById(
      "file-preview-container"
    );
    this.filePreviewImage = document.getElementById("file-preview-image");
    this.removeFileButton = document.getElementById("remove-file-button");
    this.attachedFilePath = null; // State for the currently attached file

    // --- Connect Components and Bind Events ---
    this._bindComponentEvents();
    this._bindUIEventListeners();

    // --- Load Initial Data ---
    this.init();

    console.log("App fully initialized.");
  }

  async init() {
    await this.graph.loadGraph();
    await this.updateActiveModelDisplay();
  }

  _bindComponentEvents() {
    console.log("App: Binding component events...");
    // When a node is clicked in the graph, open the workspace
    this.graph.onNodeClick((node) => {
      this.workspace.open(node);
    });

    // When the background is clicked, deselect the node in the workspace
    this.graph.onCanvasClick(() => {
      // We might add logic here later if needed
      if (this.workspace.isOpen) {
        // For now, let's not close the workspace on background click
      }
    });

    // When a node is deleted in the workspace, tell the graph to reload
    this.workspace.onNodeDeletedCallback = () => {
      this.graph.loadGraph();
    };

    // When settings are saved, update the active model display
    this.settings.onSettingsChangedCallback = () => {
      this.updateActiveModelDisplay();
    };
  }

  _bindUIEventListeners() {
    console.log("App: Binding UI event listeners...");
    this.submitButton.addEventListener("click", () => this.brainstormNewIdea());
    this.settingsButton.addEventListener("click", () => this.settings.open());

    // File upload listeners
    this.attachFileButton.addEventListener("click", () =>
      this.fileInput.click()
    );
    this.removeFileButton.addEventListener("click", () =>
      this.resetFileUpload()
    );
    this.fileInput.addEventListener("change", (e) => this.handleFileUpload(e));
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

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.filePreviewImage.src = e.target.result;
      this.attachFileButton.style.display = "none";
      this.filePreviewContainer.style.display = "block";
    };
    reader.readAsDataURL(file);

    // Upload
    const formData = new FormData();
    formData.append("file", file);

    this.loader.style.display = "block";
    try {
      const data = await this.api.uploadFile(formData);
      this.attachedFilePath = data.filePath;
      console.log("App: File uploaded, path:", this.attachedFilePath);
    } catch (error) {
      console.error("App: Upload error:", error);
      alert("Failed to upload image. Please try again.");
      this.resetFileUpload();
    } finally {
      this.loader.style.display = "none";
    }
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

    // Add user node optimistically
    const userNode = this.graph.addNode(
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
        parent_context: null, // Always null for new ideas
        source_node_id: sourceNodeId,
        attachment_path: currentAttachmentPath,
      };
      const data = await this.api.brainstorm(payload);

      // Add AI node and edge
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
      this.graph.removeNodeById(sourceNodeId); // Roll back the optimistic add
    } finally {
      this.loader.style.display = "none";
      this.submitButton.disabled = false;
      this.promptInput.value = "";
      this.resetFileUpload();
    }
  }
}

// Global helper from old script
function uuid_v4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
