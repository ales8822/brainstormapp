// frontend/js/App.js

class App {
  constructor() {
    console.log("App starting...");
    this.api = new ApiService("http://127.0.0.1:8000/api");
    this.graph = null;
    this.workspaceGraph = null;
    this.participants = [];

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
    this.workspaceParticipantList = document.getElementById(
      "workspace-participant-list"
    );
    this.workspaceAddParticipantBtn = document.getElementById(
      "workspace-add-participant-btn"
    );
    this.workspaceParticipantMenu = document.getElementById(
      "workspace-participant-menu"
    );
    this.workspaceParticipantMenuList = document.getElementById(
      "workspace-participant-menu-list"
    );
    this.workspaceMentionMenu = document.getElementById(
      "workspace-mention-menu"
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
      if (
        settingsData.runpod_url &&
        settingsData.runpod_url.trim() !== "" &&
        settingsData.runpod_url.startsWith("http") // <--- NEW CHECK
      ) {
        try {
          const ollamaData = await this.api.getOllamaModels();
          if (ollamaData.models && Array.isArray(ollamaData.models)) {
            availableModels.push(...ollamaData.models);
          }
        } catch (e) {
          // Silent fail or very low-level log if needed.
          // Since backend now returns [] on error, this catch might not even trigger often.
          console.log("Ollama not connected (skipping).");
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
    this.workspaceChatInput.addEventListener("input", (e) =>
      this._handleWorkspaceMentionInput(e)
    );
    this.workspaceAddParticipantBtn.addEventListener("click", (e) =>
      this._showWorkspaceParticipantMenu(e)
    );
    // Close menus on click outside
    document.addEventListener("click", (e) => {
      if (
        !this.workspaceParticipantMenu.contains(e.target) &&
        e.target !== this.workspaceAddParticipantBtn
      ) {
        this.workspaceParticipantMenu.style.display = "none";
      }
      // Simple logic to close mention menu if clicked elsewhere
      if (e.target !== this.workspaceChatInput) {
        this.workspaceMentionMenu.style.display = "none";
      }
    });
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
    this.participants = [];
    const nodeGeneratedBy = node.data("generated_by");
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
    // the creator model or default model
    if (
      nodeGeneratedBy &&
      this.settings.availableModels.includes(nodeGeneratedBy)
    ) {
      this.participants.push(nodeGeneratedBy);
    } else if (this.settings.availableModels.length > 0) {
      // Default to Gemini or first available
      const defaultModel =
        this.settings.availableModels.find((m) => m.includes("gemini")) ||
        this.settings.availableModels[0];
      if (defaultModel) this.participants.push(defaultModel);
    }
    this._renderWorkspaceParticipants();
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
    const cy = this.workspaceGraph.cy;

    // 1. Clean up previous listeners to avoid duplicates or stale state
    // We remove the specific handler types we are about to add
    cy.off("tap", "node");
    cy.off("tap"); // Removes the canvas click handler

    console.log("Workspace event listeners refreshed.");

    // 2. Re-bind Canvas Click (Background click)
    cy.on("tap", (event) => {
      if (event.target === cy) {
        // Only trigger if clicking the background, not a node/edge
        if (this.edgeDrawSource) {
          console.log("Cancelling edge draw.");
          this.workspaceGraph.removeClassFromAllNodes("edge-source-selected");
          this.edgeDrawSource = null;
        }
        // Always try to close inspector on background click
        this.handleWorkspaceCanvasClick();
      }
    });

    // 3. Re-bind Node Click (Inspector & Edge Draw)
    cy.on("tap", "node", (event) => {
      const targetNode = event.target;

      // CASE 1: Edge Drawing Mode
      if (this.edgeDrawSource) {
        const sourceId = this.edgeDrawSource.id();
        const targetId = targetNode.id();

        if (sourceId === targetId) {
          this.handleWorkspaceCanvasClick(); // Clicked same node -> cancel
          return;
        }

        // Create the edge
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

        this.handleWorkspaceCanvasClick(); // Reset state
        return;
      }

      // CASE 2: Open Inspector
      console.log("Node selected:", targetNode.data("label")); // Debug log
      this.inspectedNode = targetNode;

      // Update Content Editor
      if (this.inspectorContentEditor) {
        this.inspectorContentEditor.value = targetNode.data("fullText") || "";
      }

      // Show/Hide Attachment
      const attachmentPath = targetNode.data("attachment_path");
      if (this.inspectorAttachmentContainer) {
        if (attachmentPath) {
          if (this.inspectorAttachmentImage)
            this.inspectorAttachmentImage.src = attachmentPath;
          this.inspectorAttachmentContainer.style.display = "block";
        } else {
          this.inspectorAttachmentContainer.style.display = "none";
        }
      }

      // Update Status Display
      const status = targetNode.data("status") || "Idea";
      if (this.inspectorStatusDisplay) {
        const span = this.inspectorStatusDisplay.querySelector("span");
        if (span) span.textContent = status;
        this.inspectorStatusDisplay.style.display = "block";
      }

      // Show Panel
      if (this.inspectorPanel) {
        this.inspectorPanel.classList.add("visible");
      }

      this.updateInspectorStatusButtons(status);
    });

    // 4. Tippy Tooltips Setup (kept similar but ensured it runs)
    if (typeof tippy === "undefined") return;

    // Destroy old tooltips first
    cy.nodes().forEach((node) => {
      const existingTippy = node.data("tippy");
      if (existingTippy) {
        existingTippy.destroy();
        node.removeData("tippy");
      }
    });

    const setupNodeTippy = (node) => {
      const tip = tippy(document.body, {
        getReferenceClientRect: () => {
          const pos = node.renderedPosition();
          // Simple box around the node
          return {
            width: 100,
            height: 100,
            top: pos.y - 50,
            bottom: pos.y + 50,
            left: pos.x - 50,
            right: pos.x + 50,
          };
        },
        trigger: "manual",
        interactive: true,
        appendTo: document.body,
        placement: "top",
        offset: [0, 5],
        content: () => {
          const button = document.createElement("button");
          button.classList.add("edge-connector-button");
          button.innerHTML = "+";
          button.dataset.nodeId = node.id();
          // Inline styles for reliability
          button.style.cssText =
            "background:#3498db;color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;display:flex;justify-content:center;align-items:center;";
          return button;
        },
      });

      node.data("tippy", tip);

      // Bind hover events
      node.on("mouseover", () => tip.show());
      node.on("mouseout", () => setTimeout(() => tip.hide(), 500)); // Small delay
      node.on("drag", () => tip.hide());
    };

    // Apply to all nodes
    cy.nodes().forEach(setupNodeTippy);
    cy.on("add", "node", (e) => setupNodeTippy(e.target));

    // Re-bind button listener only if needed (globally)
    if (!this.workspaceButtonListenerSetup) {
      document.body.addEventListener("click", (event) => {
        if (event.target.classList.contains("edge-connector-button")) {
          event.stopPropagation(); // Prevent other clicks
          const nodeId = event.target.dataset.nodeId;
          const node = this.workspaceGraph.cy.getElementById(nodeId);

          if (node && node.data("tippy")) node.data("tippy").hide();

          console.log("Edge draw start:", nodeId);
          this.edgeDrawSource = node;
          this.workspaceGraph.addClassToNode(nodeId, "edge-source-selected");
          document.body.style.cursor = "crosshair";
          if (this.edgeModeIndicator)
            this.edgeModeIndicator.style.display = "block";
        }
      });
      this.workspaceButtonListenerSetup = true;
    }
  }

  // --- Participant & Mention Logic ---

  _renderWorkspaceParticipants() {
    this.workspaceParticipantList.innerHTML = "";
    this.participants.forEach((modelName) => {
      const tag = document.createElement("div");
      tag.className = "participant-tag";
      tag.dataset.modelTag = modelName; // For styling active state
      // Show simple name
      tag.textContent = modelName.split(":")[0];

      // Remove button
      const removeBtn = document.createElement("span");
      removeBtn.className = "remove-participant-btn";
      removeBtn.innerHTML = "&times;";
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        this._removeWorkspaceParticipant(modelName);
      };
      tag.appendChild(removeBtn);

      this.workspaceParticipantList.appendChild(tag);
    });
  }

  _removeWorkspaceParticipant(modelName) {
    if (this.participants.length <= 1) {
      alert("You must have at least one participant.");
      return;
    }
    this.participants = this.participants.filter((p) => p !== modelName);
    this._renderWorkspaceParticipants();
  }

  _showWorkspaceParticipantMenu(event) {
    event.stopPropagation();
    this.workspaceParticipantMenuList.innerHTML = "";

    const modelsToAdd = this.settings.availableModels.filter(
      (m) => !this.participants.includes(m)
    );

    if (modelsToAdd.length === 0) {
      this.workspaceParticipantMenuList.innerHTML =
        "<div style='padding:10px;'>No other models available.</div>";
    } else {
      modelsToAdd.forEach((modelName) => {
        const div = document.createElement("div");
        div.style.padding = "5px 10px";
        div.style.cursor = "pointer";
        div.textContent = modelName;
        div.onclick = () => {
          this.participants.push(modelName);
          this._renderWorkspaceParticipants();
          this.workspaceParticipantMenu.style.display = "none";
        };
        this.workspaceParticipantMenuList.appendChild(div);
      });
    }

    const rect = this.workspaceAddParticipantBtn.getBoundingClientRect();
    this.workspaceParticipantMenu.style.top = `${rect.bottom + 5}px`;
    this.workspaceParticipantMenu.style.left = `${rect.left}px`;
    this.workspaceParticipantMenu.style.display = "block";
  }

  _handleWorkspaceMentionInput(event) {
    const text = event.target.value;
    const lastWord = text.split(" ").pop();

    if (lastWord.startsWith("@") && this.participants.length > 0) {
      const searchTerm = lastWord.substring(1).toLowerCase();
      const matches = this.participants.filter((p) =>
        p.toLowerCase().includes(searchTerm)
      );
      this._showWorkspaceMentionMenu(matches);
    } else {
      this.workspaceMentionMenu.style.display = "none";
    }
  }

  _showWorkspaceMentionMenu(matches) {
    this.workspaceMentionMenu.innerHTML = "";
    if (matches.length === 0) {
      this.workspaceMentionMenu.style.display = "none";
      return;
    }

    matches.forEach((modelName) => {
      const item = document.createElement("div");
      item.className = "mention-item"; // Ensure you have css for this
      item.textContent = modelName;
      item.onclick = () => {
        const words = this.workspaceChatInput.value.split(" ");
        words.pop(); // Remove partial
        this.workspaceChatInput.value =
          words.join(" ") + (words.length > 0 ? " " : "") + `@${modelName} `;
        this.workspaceChatInput.focus();
        this.workspaceMentionMenu.style.display = "none";
      };
      this.workspaceMentionMenu.appendChild(item);
    });

    const rect = this.workspaceChatInput.getBoundingClientRect();
    this.workspaceMentionMenu.style.bottom = `${window.innerHeight - rect.top + 5
      }px`; // Above input
    this.workspaceMentionMenu.style.left = `${rect.left}px`;
    this.workspaceMentionMenu.style.display = "block";
  }

  async handleWorkspaceChatSubmit(event) {
    event.preventDefault();
    if (!this.activeWorkspaceNode) return;

    let messageText = this.workspaceChatInput.value.trim();
    const attachmentPathForThisMessage = this.workspaceAttachedFilePath;

    if (!messageText && !attachmentPathForThisMessage) return;

    let targetModel = null;
    let displayMessage = messageText;

    if (messageText.startsWith("@")) {
      const words = messageText.split(" ");
      const mention = words[0];
      const possibleModel = mention.substring(1);
      if (this.participants.includes(possibleModel)) {
        targetModel = possibleModel;
        messageText = words.slice(1).join(" "); // Clean message for AI
      }
    }

    this.appendChatMessage(
      "user",
      displayMessage,
      attachmentPathForThisMessage
    );
    this.workspaceChatInput.value = "";
    this.workspaceChatInput.focus();

    const submitBtn = this.workspaceChatForm.querySelector(
      "button[type='submit']"
    );
    submitBtn.disabled = true;

    this.chatHistory.push({ role: "user", parts: [messageText] });

    const participantsToCall = targetModel ? [targetModel] : this.participants;

    if (participantsToCall.length === 0) {
      this.appendChatMessage(
        "model",
        "Error: No AI model selected. Please add a participant using the '+' button."
      );
      submitBtn.disabled = false;
      return;
    }

    const isGroupChat = participantsToCall.length > 1;

    // --- LOGIC FOR SINGLE CHAT (Non-streaming) ---
    if (!isGroupChat) {
      const modelName = participantsToCall[0];
      const thinkingIndicator = this.appendChatMessage(
        "model",
        "Thinking...",
        attachmentPathForThisMessage,
        modelName
      );
      thinkingIndicator.classList.add("thinking-bubble");

      try {
        const payload = {
          nodeId: this.activeWorkspaceNode.id(),
          nodeContext: this.activeWorkspaceNode.data("fullText"),
          history: this.chatHistory,
          userMessage: messageText,
          attachmentPath: attachmentPathForThisMessage,
        };
        const response = await this.api.sendMessage(payload);
        const textSpan = thinkingIndicator.querySelector(".message-content");
        if (textSpan) textSpan.textContent = response.response;
        thinkingIndicator.classList.remove("thinking-bubble");
        this.chatHistory.push({
          role: "model",
          parts: [response.response],
          generated_by: response.model_name,
        });
      } catch (error) {
        thinkingIndicator.querySelector(
          ".message-content"
        ).textContent = `Error: ${error.message}`;
        thinkingIndicator.classList.remove("thinking-bubble");
      } finally {
        submitBtn.disabled = false;
        if (attachmentPathForThisMessage) {
          this.resetWorkspaceFileUpload();
        }
      }
      return;
    }

    // --- LOGIC FOR GROUP CHAT (Streaming) ---
    const activeBubbles = {};
    // ** THE FIX IS HERE: Create bubbles before the API call **
    participantsToCall.forEach((modelName) => {
      const bubble = this.appendChatMessage(
        "model",
        "Thinking...",
        attachmentPathForThisMessage,
        modelName
      );
      bubble.classList.add("thinking-bubble");
      activeBubbles[modelName] = bubble;
    });

    const payload = {
      nodeId: this.activeWorkspaceNode.id(),
      nodeContext: this.activeWorkspaceNode.data("fullText"),
      history: this.chatHistory,
      userMessage: messageText,
      participants: participantsToCall,
      attachmentPath: attachmentPathForThisMessage,
    };

    // Call the streaming API.
    this.api.streamGroupChat(
      payload,
      // onData callback
      (data) => {
        if (data.error || !data.model_name) {
          console.error("Stream data error:", data);
          return;
        }
        const model = data.model_name;
        if (activeBubbles[model]) {
          const textSpan =
            activeBubbles[model].querySelector(".message-content");
          if (textSpan) textSpan.textContent = data.response;
          activeBubbles[model].classList.remove("thinking-bubble");
        }
      },
      // onComplete callback
      () => {
        console.log("Group chat stream completed.");
        Object.keys(activeBubbles).forEach((model) => {
          const bubble = activeBubbles[model];
          const finalResponse =
            bubble.querySelector(".message-content").textContent;
          if (!finalResponse.includes("Thinking...")) {
            this.chatHistory.push({
              role: "model",
              parts: [finalResponse],
              generated_by: model,
            });
          }
        });
        submitBtn.disabled = false;
        if (attachmentPathForThisMessage) {
          this.resetWorkspaceFileUpload();
        }
      }
    );
  }

  // Update helper to support model header
  appendChatMessage(role, text, attachmentPath = null, modelName = null) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("chat-message", role);

    // Store the attachment path on the element's dataset so it can be
    // retrieved later by the "Promote" button.
    if (attachmentPath) {
      messageElement.dataset.attachmentPath = attachmentPath;
    }

    // Add a header for AI messages that specifies the model name
    if (role === "model" && modelName) {
      const header = document.createElement("div");
      header.classList.add("message-header");
      header.textContent = modelName;
      messageElement.appendChild(header);
    }

    // Add the text content in its own span for easy selection
    const textSpan = document.createElement("span");
    textSpan.className = "message-content";
    if (text) {
      textSpan.textContent = text;
    }
    messageElement.appendChild(textSpan);

    // Add the image thumbnail if an attachment path exists
    if (attachmentPath) {
      const img = document.createElement("img");
      img.src = attachmentPath;
      img.classList.add("chat-message-attachment");
      messageElement.appendChild(img);
    }

    // Add the "Promote" button for all AI messages
    if (role === "model") {
      const promoteBtn = document.createElement("button");
      promoteBtn.classList.add("promote-button");
      promoteBtn.textContent = "+";
      promoteBtn.title = "Promote to node";
      promoteBtn.addEventListener("click", (event) => {
        const parentMessage = event.currentTarget.parentElement;
        const currentText =
          parentMessage.querySelector(".message-content")?.textContent ||
          "Image Analysis";
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
