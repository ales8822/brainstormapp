// frontend/js/App.js

class App {
  constructor() {
    console.log("App starting...");
    this.api = new ApiService("http://127.0.0.1:8000/api");
    this.graph = null;
    this.workspaceGraph = null;

    this.workspace = new IdeaWorkspace(this.api);
    this.settings = new SettingsModal(this.api);
    this.settings.currentSettings = {};

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

    this.overviewView = document.getElementById("overview-view");
    this.workspaceView = document.getElementById("workspace-view");
    this.breadcrumbHome = document.getElementById("breadcrumb-home");
    this.breadcrumbIdeaName = document.getElementById("breadcrumb-idea-name");

    this.workspaceChatForm = document.getElementById("workspace-chat-form");
    this.workspaceChatInput = document.getElementById("workspace-chat-input");
    this.workspaceChatMessages = document.getElementById(
      "workspace-chat-messages"
    );

    // --- ADD WORKSPACE ATTACHMENT REFS ---
    this.workspaceFileInput = document.getElementById("workspace-file-input");
    this.workspaceAttachFileButton = document.getElementById(
      "workspace-attach-file-button"
    );
    this.workspaceFilePreviewContainer = document.getElementById(
      "workspace-file-preview-container"
    );
    this.workspaceFilePreviewImage = document.getElementById(
      "workspace-file-preview-image"
    );
    this.workspaceRemoveFileButton = document.getElementById(
      "workspace-remove-file-button"
    );

    this.edgeModeIndicator = document.getElementById("edge-mode-indicator");

    // --- DOM REFS FOR INSPECTOR ---
    this.inspectorPanel = document.getElementById("workspace-inspector-panel");

    this.inspectorAttachmentContainer = document.getElementById(
      "inspector-attachment-container"
    );
    this.inspectorAttachmentImage = document.getElementById(
      "inspector-attachment-image"
    );
    this.inspectorContentEditor = document.getElementById(
      "inspector-content-editor"
    );
    this.inspectorStatusDisplay = document.getElementById(
      "inspector-status-display"
    );
    this.inspectorSaveButton = document.getElementById("inspector-save-button");
    this.inspectorStatusControls = document.getElementById(
      "inspector-status-controls"
    );
    this.activeWorkspaceNode = null;
    this.chatHistory = [];
    this.attachedFilePath = null;
    this.workspaceAttachedFilePath = null;
    this.inspectedNode = null;
    this._bindUIEventListeners();
    this.workspaceEventListenersSetup = false;
    this.workspaceButtonListenerSetup = false;
  }

  async init() {
    console.log("App.init: Starting initialization...");
    if (window.location.hash.startsWith("#/workspace/")) {
      console.log("Routing: Hiding overview early to prevent flicker.");
      this.overviewView.style.display = "none";
      this.workspaceView.style.display = "flex";
    }

    try {
      const settingsData = await this.api.getSettings();
      this.settings.currentSettings = settingsData;
      let availableModels = [];

      if (settingsData.gemini_api_key) {
        availableModels.push("gemini-2.0-flash");
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

    this.graph = new GraphManager("cy", this.api);
    this.workspaceGraph = new GraphManager("workspace-cy", this.api);
    this._bindComponentEvents();

    await this.graph.loadGraph();
    await this.updateActiveModelDisplay();

    this._handleInitialRouting();
    console.log("App fully initialized and ready.");
  }

  _handleInitialRouting() {
    const hash = window.location.hash;
    if (hash.startsWith("#/workspace/")) {
      const nodeId = hash.substring("#/workspace/".length);
      console.log(`Routing: Found workspace ID in URL: ${nodeId}`);

      const node = this.graph.cy.getElementById(nodeId);

      if (node && node.length > 0) {
        this.enterWorkspace(node.first());
      } else {
        console.warn(
          `Routing: Node with ID ${nodeId} not found. Defaulting to overview.`
        );
        window.location.hash = "";
      }
    }
  }

  _bindComponentEvents() {
    this.graph.onNodeDoubleClick((node) => this.enterWorkspace(node));
    // this.workspaceGraph.onNodeClick((node) =>
    //   this.handleWorkspaceNodeClick(node)
    // );

    this.workspaceGraph.onCanvasClick(() => this.handleWorkspaceCanvasClick());
    this.workspace.onNodeDeletedCallback = () => this.graph.loadGraph();
    this.settings.onSettingsChangedCallback = () => this.onSettingsChanged();
  }

  _bindUIEventListeners() {
    this.submitButton.addEventListener("click", () => this.brainstormNewIdea());
    this.settingsButton.addEventListener("click", () => this.settings.open());

    this.breadcrumbHome.addEventListener("click", (e) => {
      e.preventDefault();
      this.exitWorkspace();
    });

    this.workspaceChatForm.addEventListener("submit", (e) =>
      this.handleWorkspaceChatSubmit(e)
    );
    this.attachFileButton.addEventListener("click", () =>
      this.fileInput.click()
    );
    this.removeFileButton.addEventListener("click", () =>
      this.resetFileUpload()
    );
    this.fileInput.addEventListener("change", (e) => this.handleFileUpload(e));
    // --- ADD WORKSPACE ATTACHMENT LISTENERS ---
    this.workspaceAttachFileButton.addEventListener("click", () =>
      this.workspaceFileInput.click()
    );
    this.workspaceFileInput.addEventListener("change", (e) =>
      this.handleWorkspaceFileUpload(e)
    );
    this.workspaceRemoveFileButton.addEventListener("click", () =>
      this.resetWorkspaceFileUpload()
    );

    document.addEventListener("keydown", (e) => this.handleKeyDown(e));
    this.inspectorStatusControls.addEventListener("click", (e) => {
      console.log(
        "Inspector status area was clicked. Clicked element:",
        e.target
      );
      if (e.target.matches(".status-btn")) {
        this.handleInspectorStatusChange(e.target.dataset.status);
      } else {
        console.log("Clicked element did NOT match '.status-btn'");
      }
    });
    this.inspectorSaveButton.addEventListener("click", () =>
      this.handleInspectorSave()
    );
  }

  async enterWorkspace(node) {
    console.log(`Entering workspace for node: ${node.data("label")}`);
    this.activeWorkspaceNode = node;
    this.chatHistory = [];
    this.breadcrumbIdeaName.textContent = node.data("label");
    this.workspaceChatMessages.innerHTML = "";
    this.handleWorkspaceCanvasClick();
    this.workspaceGraph.rerunLayout();
    this.setupWorkspaceEventListeners();
    this.workspaceGraph.clear();
    window.location.hash = `#/workspace/${node.id()}`;

    this.overviewView.style.display = "none";
    this.workspaceView.style.display = "flex";

    this.workspaceGraph.resize();

    try {
      const workspaceElements = await this.api.getWorkspaceElements(node.id());
      if (workspaceElements.length > 0) {
        // The API returns an array of Cytoscape elements (nodes and edges)
        // The addNodes method is actually generic and can add any collection of elements.
        this.workspaceGraph.addNodes(workspaceElements);
      }
    } catch (error) {
      console.error("Failed to load workspace elements:", error);
      alert("Could not load the workspace content.");
    }

    this.workspaceGraph.rerunLayout();

    // Setup event listeners AFTER nodes are loaded and layout is complete
    this.setupWorkspaceEventListeners();
  }

  exitWorkspace() {
    console.log("Exiting workspace back to overview.");
    this.activeWorkspaceNode = null;
    this.edgeDrawSource = null; // Clear edge drawing state
    this.inspectedNode = null;
    this.resetWorkspaceFileUpload(); // Reset attachment when leaving
    document.body.style.cursor = "default"; // Reset cursor
    window.location.hash = "";
    this.workspaceView.style.display = "none";
    this.overviewView.style.display = "flex";
  }

  async handleKeyDown(event) {
    // Ignore if typing in an input field
    if (
      event.target.tagName === "INPUT" ||
      event.target.tagName === "TEXTAREA"
    ) {
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault(); // Always prevent default browser action

      // Determine which graph is active
      const activeGraph = this.activeWorkspaceNode
        ? this.workspaceGraph
        : this.graph;
      if (!activeGraph) return;

      const selected = activeGraph.cy.$(":selected");
      if (selected.length === 0) return;

      const selectedEdge = selected.filter("edge");
      const selectedNode = selected.filter("node");

      if (selectedEdge.length > 0) {
        // Edge deletion only happens in the workspace
        const edge = selectedEdge.first();
        const sourceId = edge.source().id();
        const targetId = edge.target().id();
        const edgeId = edge.id();

        try {
          edge.remove();
          await this.api.deleteEdge({ source: sourceId, target: targetId });
          console.log("Edge deleted from database.");
        } catch (error) {
          console.error("Failed to delete edge:", error);
          activeGraph.addEdge({
            source: sourceId,
            target: targetId,
            id: edgeId,
          });
          alert("Failed to delete connection.");
        }
      } else if (selectedNode.length > 0) {
        const node = selectedNode.first();
        const nodeId = node.id();

        // Use a different confirmation message depending on the context
        const isIdeaNode = !this.activeWorkspaceNode;
        const confirmationMessage = isIdeaNode
          ? `Are you sure you want to delete the entire idea "${node.data(
              "label"
            )}" and all its contents? This cannot be undone.`
          : `Are you sure you want to delete the node "${node.data(
              "label"
            )}"? This cannot be undone.`;

        if (!confirm(confirmationMessage)) {
          return;
        }

        try {
          node.remove();
          await this.api.deleteNode(nodeId);
          console.log(`Node ${nodeId} deleted from database.`);
        } catch (error) {
          console.error(`Failed to delete node ${nodeId}:`, error);
          alert(
            "Failed to delete the node. The view will be reloaded to ensure consistency."
          );
          // Reload the appropriate graph
          if (isIdeaNode) {
            this.graph.loadGraph();
          } else {
            this.enterWorkspace(this.activeWorkspaceNode);
          }
        }
      }
    }
  }

  setupWorkspaceEventListeners() {
    // Remove the "only once" check - we need to reinitialize tooltips each time
    const cy = this.workspaceGraph.cy;

    // Only set up canvas/edge drawing listeners once
    if (!this.workspaceEventListenersSetup) {
      cy.on("tap", (event) => {
        if (event.target === cy && this.edgeDrawSource) {
          console.log("Cancelling edge draw.");
          this.workspaceGraph.removeClassFromAllNodes("edge-source-selected");
          this.edgeDrawSource = null;
        }
      });

      cy.on("tap", "node", (event) => {
        const targetNode = event.target;

        // CASE 1: We are in edge-drawing mode.
        if (this.edgeDrawSource) {
          const sourceId = this.edgeDrawSource.id();
          const targetId = targetNode.id();

          // If user clicks the same node, cancel the draw.
          if (sourceId === targetId) {
            this.handleWorkspaceCanvasClick(); // Reuse cancel logic
            return;
          }

          // Complete the edge draw
          const edgeId = `edge-${sourceId}-${targetId}`;
          if (cy.getElementById(edgeId).length === 0) {
            this.workspaceGraph.addEdge({
              id: edgeId,
              source: sourceId,
              target: targetId,
            });
            this.api
              .createEdge({ source: sourceId, target: targetId })
              .then(() => console.log(`Edge saved: ${sourceId} -> ${targetId}`))
              .catch((err) => {
                console.error("Failed to save edge:", err);
                this.workspaceGraph.removeNodeById(edgeId);
                alert("Failed to save connection.");
              });
          }

          this.handleWorkspaceCanvasClick(); // Reuse cancel logic to reset state
          return; // IMPORTANT: Stop execution here
        }

        // CASE 2: We are NOT in edge-drawing mode. This is a normal node click.
        console.log("Node selected for inspector:", targetNode.data("label"));
        this.inspectedNode = targetNode;
        this.inspectorContentEditor.value = targetNode.data("fullText");
        // --- SHOW/HIDE ATTACHMENT ---
        const attachmentPath = targetNode.data("attachment_path");
        if (attachmentPath) {
          this.inspectorAttachmentImage.src = attachmentPath;
          this.inspectorAttachmentContainer.style.display = "block";
        } else {
          this.inspectorAttachmentContainer.style.display = "none";
        }
        // --- NEW LOGIC ---
        this.inspectorStatusDisplay.querySelector("span").textContent =
          targetNode.data("status");
        this.inspectorStatusDisplay.style.display = "block"; // Make sure it's visible

        this.inspectorPanel.classList.add("visible");
        this.updateInspectorStatusButtons(targetNode.data("status"));
      });
      // --- END OF REPLACEMENT BLOCK ---

      this.workspaceEventListenersSetup = true;
    }

    // Check if tippy is available before setting up tooltips
    if (typeof tippy === "undefined") {
      console.warn("Tippy.js not available, skipping tooltip setup");
      return;
    }

    // Clean up any existing tooltips first
    cy.nodes().forEach((node) => {
      const existingTippy = node.data("tippy");
      if (existingTippy) {
        existingTippy.destroy();
        node.removeData("tippy");
      }
    });

    console.log(`Setting up Tippy tooltips for ${cy.nodes().length} nodes`);

    const setupNodeTippy = (node) => {
      const tip = tippy(document.body, {
        getReferenceClientRect: () => {
          const pos = node.renderedPosition();
          const rect = {
            width: 150,
            height: 150,
            top: pos.y - 80,
            bottom: pos.y - 80 + 150,
            left: pos.x - 75,
            right: pos.x - 75 + 150,
          };
          return rect;
        },
        trigger: "manual",
        interactive: true,
        appendTo: document.body,
        placement: "top",
        offset: [0, 10],
        hideOnClick: false,
        onShow(instance) {
          // Store reference for manual hiding
          node.data("tippyInstance", instance);
        },
        content: () => {
          const button = document.createElement("button");
          button.classList.add("edge-connector-button");
          button.innerHTML = "+";
          button.dataset.nodeId = node.id();
          button.style.cssText = `
            background: #3498db;
            color: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
          `;
          button.onmouseover = () => {
            button.style.background = "#2980b9";
            button.style.transform = "scale(1.1)";
          };
          button.onmouseout = () => {
            button.style.background = "#3498db";
            button.style.transform = "scale(1)";
          };
          return button;
        },
      });

      node.data("tippy", tip);

      let hoverTimeout;
      let isOverTooltip = false;

      node.on("mouseover", () => {
        clearTimeout(hoverTimeout);
        tip.show();
      });

      node.on("mouseout", () => {
        hoverTimeout = setTimeout(() => {
          if (!isOverTooltip) {
            tip.hide();
          }
        }, 150);
      });

      // Track when mouse is over tooltip content
      tip.popper.addEventListener("mouseenter", () => {
        isOverTooltip = true;
        clearTimeout(hoverTimeout);
      });

      tip.popper.addEventListener("mouseleave", () => {
        isOverTooltip = false;
        tip.hide();
      });

      // Hide tooltip when node is dragged
      node.on("drag", () => {
        tip.hide();
      });
    };

    cy.nodes().forEach(setupNodeTippy);

    cy.on("add", "node", (event) => {
      setupNodeTippy(event.target);
    });

    // Set up the click listener for "+" buttons (only once)
    if (!this.workspaceButtonListenerSetup) {
      document.body.addEventListener("click", (event) => {
        const target = event.target;

        // Handle "+" button clicks
        if (target.classList.contains("edge-connector-button")) {
          event.stopPropagation();
          event.preventDefault();
          const nodeId = target.dataset.nodeId;
          const node = this.workspaceGraph.cy.getElementById(nodeId);

          // Hide the tooltip
          if (node && node.data("tippy")) node.data("tippy").hide();

          console.log(`Edge draw initiated from node: ${nodeId}`);
          this.workspaceGraph.removeClassFromAllNodes("edge-source-selected");
          this.edgeDrawSource = node;
          this.workspaceGraph.addClassToNode(nodeId, "edge-source-selected");

          // Visual feedback
          document.body.style.cursor = "crosshair";
          if (this.edgeModeIndicator) {
            this.edgeModeIndicator.style.display = "block";
          }
          return;
        }
      });
      this.workspaceButtonListenerSetup = true;
    }
  }

  async handleWorkspaceChatSubmit(event) {
    event.preventDefault();
    if (!this.activeWorkspaceNode) return;

    const messageText = this.workspaceChatInput.value.trim();
    const attachmentPathForThisMessage = this.workspaceAttachedFilePath; // Capture the path for this specific message

    if (!messageText && !attachmentPathForThisMessage) return;

    this.appendChatMessage("user", messageText, attachmentPathForThisMessage);
    this.workspaceChatInput.value = "";
    this.workspaceChatInput.focus();

    this.chatHistory.push({ role: "user", parts: [messageText] });
    const thinkingIndicator = this.appendChatMessage("model", "Thinking...");

    try {
      const payload = {
        nodeId: this.activeWorkspaceNode.id(),
        nodeContext: this.activeWorkspaceNode.data("fullText"),
        history: this.chatHistory,
        userMessage: messageText,
        attachmentPath: attachmentPathForThisMessage,
      };

      const response = await this.api.sendMessage(payload);
      const aiResponseText = response.response;

      // --- FIX: Update the AI's message bubble with text and attachment context ---
      const textSpan = thinkingIndicator.querySelector("span");
      if (textSpan) {
        textSpan.textContent = aiResponseText;
      }

      // If this was a response to an image, add the context to the AI's message bubble
      if (attachmentPathForThisMessage) {
        thinkingIndicator.dataset.attachmentPath = attachmentPathForThisMessage;
        const img = document.createElement("img");
        img.src = attachmentPathForThisMessage;
        img.classList.add("chat-message-attachment");
        thinkingIndicator.appendChild(img);
      }
      // --- END FIX ---

      this.chatHistory.push({ role: "model", parts: [aiResponseText] });
    } catch (error) {
      thinkingIndicator.textContent = `Error: ${error.message}`;
    } finally {
      // Don't reset the file upload here, allow it to be sticky
    }
  }

  appendChatMessage(role, text, attachmentPath = null) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("chat-message", role);

    if (attachmentPath) {
      messageElement.dataset.attachmentPath = attachmentPath;
    }

    if (text) {
      const textSpan = document.createElement("span");
      textSpan.textContent = text;
      messageElement.appendChild(textSpan);
    }

    if (attachmentPath && role === "user") {
      // Only show thumbnail on user message initially
      const img = document.createElement("img");
      img.src = attachmentPath;
      img.classList.add("chat-message-attachment");
      messageElement.appendChild(img);
    }

    // --- REVERTED FIX: Always add promote button for AI messages ---
    if (role === "model") {
      const promoteBtn = document.createElement("button");
      promoteBtn.classList.add("promote-button");
      promoteBtn.textContent = "+";
      promoteBtn.title = "Promote to node";
      promoteBtn.addEventListener("click", (event) => {
        const parentMessage = event.currentTarget.parentElement;
        // If there's text, use it. Otherwise, provide a default.
        const currentText =
          parentMessage.querySelector("span")?.textContent || "Image Analysis";
        const currentAttachment = parentMessage.dataset.attachmentPath || null;
        this.handlePromoteMessage(currentText, currentAttachment);
      });
      messageElement.appendChild(promoteBtn);
    }

    this.workspaceChatMessages.appendChild(messageElement);
    this.workspaceChatMessages.scrollTop =
      this.workspaceChatMessages.scrollHeight;
    return messageElement;
  }

  async handlePromoteMessage(messageText, attachmentPath = null) {
    if (!this.activeWorkspaceNode) {
      console.error("Cannot promote node, no active workspace.");
      return;
    }

    try {
      const payload = {
        parentNodeId: this.activeWorkspaceNode.id(),
        label: messageText.substring(0, 100),
        fullText: messageText,
        attachmentPath: attachmentPath, // Pass the attachment path
      };

      const newNode = await this.api.promoteMessageToNode(payload);
      this.workspaceGraph.addNode(newNode.data, newNode.classes);
      this.workspaceGraph.rerunLayout();
    } catch (error) {
      console.error("App: Failed to promote message to node:", error);
      alert(`Error saving node: ${error.message}`);
    }
  }

  resetWorkspaceFileUpload() {
    this.workspaceFileInput.value = "";
    this.workspaceAttachedFilePath = null;
    this.workspaceFilePreviewContainer.style.display = "none";
    this.workspaceAttachFileButton.style.display = "block";
  }

  async handleWorkspaceFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      this.workspaceFilePreviewImage.src = e.target.result;
      this.workspaceAttachFileButton.style.display = "none";
      this.workspaceFilePreviewContainer.style.display = "block";
    };
    reader.readAsDataURL(file);

    // Upload file
    const formData = new FormData();
    formData.append("file", file);
    this.loader.style.display = "block"; // You might want a more targeted loader
    try {
      const data = await this.api.uploadFile(formData);
      this.workspaceAttachedFilePath = data.filePath;
      console.log(
        "Workspace file uploaded, path:",
        this.workspaceAttachedFilePath
      );
    } catch (error) {
      console.error("Workspace upload error:", error);
      alert("Failed to upload image.");
      this.resetWorkspaceFileUpload();
    } finally {
      this.loader.style.display = "none";
    }
  }

  async onSettingsChanged() {
    console.log("App: Settings changed, re-initializing...");
    await this.init();
  }

  async brainstormNewIdea() {
    const promptText = this.promptInput.value;
    if (!promptText.trim()) {
      alert("Please enter an idea to start.");
      return;
    }

    if (this.attachedFilePath) {
      alert(
        "Attachments can only be used inside an idea workspace. Please remove the image to create a new idea."
      );
      return;
    }

    this.loader.style.display = "block";
    this.submitButton.disabled = true;

    try {
      const newNodeData = await this.api.createSimpleNode(promptText);

      this.graph.addNode(newNodeData.data, newNodeData.classes);

      this.graph.rerunLayout();
    } catch (error) {
      console.error("App: Error in creating simple idea node:", error);
      alert(error.message);
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

  handleWorkspaceCanvasClick() {
    console.log(
      "Workspace canvas clicked - cleaning up tooltips and edge mode"
    );
    // Hide Inspector
    this.inspectorContentEditor.value = "";
    this.inspectorPanel.classList.remove("visible");
    this.inspectedNode = null; // Clear the inspected node
    this.inspectorStatusDisplay.style.display = "none"; // Hide the status
    // Force hide all tooltips
    const cy = this.workspaceGraph.cy;
    cy.nodes().forEach((node) => {
      const tippy = node.data("tippy");
      if (tippy) {
        tippy.hide();
      }
    });

    // Cancel edge drawing if active
    if (this.edgeDrawSource) {
      console.log("Cancelling edge draw from canvas click");
      this.workspaceGraph.removeClassFromAllNodes("edge-source-selected");
      this.edgeDrawSource = null;
    }
    this.inspectorContentEditor.innerHTML = `<p class="inspector-placeholder">Click a node to see its full content.</p>`;
    this.inspectorPanel.classList.remove("visible");
    this.inspectedNode = null; // Clear the inspected node
    // Always reset cursor and indicator
    document.body.style.cursor = "default";
    if (this.edgeModeIndicator) {
      this.edgeModeIndicator.style.display = "none";
    }
  }
  async handleInspectorSave() {
    if (!this.inspectedNode) return;

    const nodeId = this.inspectedNode.id();
    const newText = this.inspectorContentEditor.value;
    console.log(`Saving new content for node ${nodeId}`);

    try {
      // Show some visual feedback, e.g., disable button
      this.inspectorSaveButton.disabled = true;
      this.inspectorSaveButton.textContent = "Saving...";

      const response = await this.api.updateNodeContent(nodeId, newText);

      // Update the node data on the frontend
      this.inspectedNode.data("fullText", newText);
      this.inspectedNode.data("label", response.new_label);

      console.log("Node content updated successfully.");
    } catch (error) {
      console.error("Failed to save node content:", error);
      alert("Could not save changes.");
    } finally {
      // Re-enable button
      this.inspectorSaveButton.disabled = false;
      this.inspectorSaveButton.textContent = "Save Changes";
    }
  }
  // --- ADD THIS NEW HANDLER ---
  async handleInspectorStatusChange(newStatus) {
    if (!this.inspectedNode) return;

    const nodeId = this.inspectedNode.id();
    const oldStatus = this.inspectedNode.data("status");
    console.log(
      `Updating status for node ${nodeId} from ${oldStatus} to ${newStatus}`
    );

    try {
      // API call
      await this.api.updateNodeStatus(nodeId, newStatus);

      // Update UI
      this.inspectedNode.data("status", newStatus);
      this.inspectedNode.removeClass(`status-${oldStatus}`);
      this.inspectedNode.addClass(`status-${newStatus}`);
      this.updateInspectorStatusButtons(newStatus);
      this.inspectorStatusDisplay.querySelector("span").textContent = newStatus;
    } catch (error) {
      console.error("Failed to update node status:", error);
      alert("Could not save the new status.");
    }
  }

  // --- ADD THIS NEW HELPER METHOD ---
  updateInspectorStatusButtons(currentStatus) {
    const buttons =
      this.inspectorStatusControls.querySelectorAll(".status-btn");
    buttons.forEach((btn) => {
      if (btn.dataset.status === currentStatus) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }
}

function uuid_v4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function main() {
  if (window.app) {
    console.warn("App already initialized, skipping duplicate call.");
    return;
  }

  console.log("main() is called.");
  window.app = new App();
  await window.app.init();
}

if (!window.app) {
  main();
}
