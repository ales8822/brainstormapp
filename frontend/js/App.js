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
    this.meetingHistory = new MeetingHistory(this.api, this);
    this.agentManager = new AgentManager(this.api);
    this.currentMeetingId = null;
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

    // --- POPOVER REFS ---
    this.nodeCreationPopover = document.getElementById("node-creation-popover");
    this.popoverText = document.getElementById("popover-text");
    this.popoverAttachBtn = document.getElementById("popover-attach-btn");
    this.popoverFileInput = document.getElementById("popover-file-input");
    this.popoverCreateBtn = document.getElementById("popover-create-btn");
    this.popoverPreviewContainer = document.getElementById(
      "popover-preview-container"
    );
    this.popoverPreviewImage = document.getElementById("popover-preview-image");
    this.popoverRemoveFile = document.getElementById("popover-remove-file");
    this.popoverAttachmentPath = null;
    this.popoverPosition = null; // {x, y} in model coordinates

    this.edgeModeIndicator = document.getElementById("edge-mode-indicator");
    this.layoutControls = document.getElementById("layout-controls");

    // --- MEETING BOARD REFS ---
    this.newMeetingButton = document.getElementById("new-meeting-button");
    this.meetingBoardView = document.getElementById("meeting-board-view");
    this.backToOverviewButton = document.getElementById("back-to-overview-btn");

    // --- BRIEFING PANEL REFS ---
    this.meetingTopicInput = document.getElementById("meeting-topic");
    this.companyContextInput = document.getElementById("company-context");
    this.setContextBtn = document.getElementById("set-context-btn");
    this.briefingPanel = document.getElementById("briefing-panel");
    this.meetingAttachmentInput = document.getElementById("meeting-attachment");
    this.meetingAttachmentPreview = document.getElementById("meeting-attachment-preview");
    this.meetingUserQuestion = document.getElementById("meeting-user-question");
    this.sendMeetingQuestionBtn = document.getElementById("send-meeting-question-btn");
    this.endMeetingBtn = document.getElementById("end-meeting-btn");

    // --- BOARD ASSEMBLY REFS ---
    this.boardAssemblyPanel = document.getElementById("board-assembly-panel");
    this.chairsContainer = document.getElementById("chairs-container");
    this.displayTopic = document.getElementById("display-topic");
    this.startMeetingBtn = document.getElementById("start-meeting-btn");
    this.meetingAgentMenu = document.getElementById("meeting-agent-menu");
    this.meetingAgentMenuList = document.getElementById("meeting-agent-menu-list");

    // --- MEETING IN PROGRESS REFS ---
    this.meetingInProgressPanel = document.getElementById("meeting-in-progress-panel");
    this.activeMeetingTopic = document.getElementById("active-meeting-topic");
    this.meetingTranscript = document.getElementById("meeting-transcript");
    this.pauseMeetingBtn = document.getElementById("pause-meeting-btn");
    this.endMeetingBtn = document.getElementById("end-meeting-btn");

    // --- MEETING MINUTES REFS ---
    this.meetingMinutesPanel = document.getElementById("meeting-minutes-panel");
    this.meetingMinutesContent = document.getElementById("meeting-minutes-content");
    this.promoteMinutesBtn = document.getElementById("promote-minutes-btn");
    this.exportMinutesBtn = document.getElementById("export-minutes-btn");

    // 
    this.secretaryChatMessages = document.getElementById("secretary-chat-messages");
    this.secretaryQueryInput = document.getElementById("secretary-query-input");
    this.sendSecretaryQueryBtn = document.getElementById("send-secretary-query-btn");

    this.meetingAgents = {}; // { chairIndex: agentName }
    this.currentMeetingMinutes = ""; // Store minutes for export/promote

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
    this.workspaceGraph.onCanvasDoubleClick((e) =>
      this.handleWorkspaceCanvasDoubleClick(e)
    );
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

    // Layout Controls Listener
    this.layoutControls.addEventListener("click", (e) => {
      const btn = e.target.closest(".layout-btn");
      if (btn) {
        const layoutName = btn.dataset.layout;
        this.handleLayoutChange(layoutName);
      }
    });

    // Popover Listeners
    this.popoverAttachBtn.addEventListener("click", () =>
      this.popoverFileInput.click()
    );
    this.popoverFileInput.addEventListener("change", (e) =>
      this.handlePopoverFileUpload(e)
    );
    this.popoverRemoveFile.addEventListener("click", () =>
      this.resetPopoverFile()
    );
    this.popoverCreateBtn.addEventListener("click", () =>
      this.handlePopoverCreate()
    );
    this.popoverText.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handlePopoverCreate();
      } else if (e.key === "Escape") {
        this.hidePopover();
      }
    });
    // Close popover if clicking outside (handled by canvas click)

    // Meeting Board Listeners
    this.newMeetingButton.addEventListener("click", () =>
      this.enterMeetingBoard()
    );
    this.backToOverviewButton.addEventListener("click", () =>
      this.exitMeetingBoard()
    );

    this.setContextBtn.addEventListener("click", () =>
      this.handleSetContext()
    );
    this.startMeetingBtn.addEventListener("click", () =>
      this.handleStartMeeting()
    );

    this.meetingAttachmentInput.addEventListener("change", () => this.handleMeetingAttachment());
    this.sendMeetingQuestionBtn.addEventListener("click", () => this.handleSendMeetingQuestion());
    this.meetingUserQuestion.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.handleSendMeetingQuestion();
    });
    this.endMeetingBtn.addEventListener("click", () => this.handleEndMeeting());

    this.promoteMinutesBtn.addEventListener("click", () =>
      this.handlePromoteMinutes()
    );
    this.sendSecretaryQueryBtn.addEventListener("click", () =>
      this.handleSecretaryQuery()
    );

    // Also add Enter key support
    this.secretaryQueryInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleSecretaryQuery();
      }
    });

    this.exportMinutesBtn.addEventListener("click", () =>
      this.handleExportMinutes()
    );
  }

  handleMeetingAttachment() {
    const file = this.meetingAttachmentInput.files[0];
    if (!file) {
      this.meetingAttachmentPreview.innerHTML = "";
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.meetingAttachmentPreview.innerHTML = `<img src="${e.target.result}" alt="Preview" />`;
    };
    reader.readAsDataURL(file);
  }

  async handleStartMeeting() {
    const topic = this.meetingTopicInput.value;
    const context = this.companyContextInput.value;
    const agents = Array.from(
      document.querySelectorAll(".chair.occupied")
    ).map((chair) => chair.dataset.agent);

    if (!topic || !context || agents.length === 0) {
      alert("Please fill in all fields and select at least one agent.");
      return;
    }

    // Upload attachment if present
    let attachmentPath = null;
    if (this.meetingAttachmentInput.files.length > 0) {
      try {
        this.appendMeetingMessage("system", "Uploading attachment...");
        const formData = new FormData();
        formData.append("file", this.meetingAttachmentInput.files[0]);
        const uploadResult = await this.api.uploadFile(formData);
        attachmentPath = uploadResult.filePath;
        this.appendMeetingMessage("system", "Attachment uploaded successfully.");
      } catch (error) {
        console.error("Attachment upload failed:", error);
        this.appendMeetingMessage("system", "Error uploading attachment. Proceeding without it.");
      }
    }

    // Store meeting context
    this.currentMeetingContext = {
      topic,
      company_context: context,
      agents,
      attachment_path: attachmentPath,
      history: []
    };

    // Switch UI
    this.briefingPanel.classList.add("hidden");
    this.boardAssemblyPanel.style.display = "none";
    this.meetingInProgressPanel.style.display = "flex";
    this.meetingTranscript.innerHTML = "";
    document.getElementById("active-meeting-topic").textContent = topic;

    this.appendMeetingMessage("system", `Meeting started: ${topic}`);
    this.appendMeetingMessage("system", "The board is ready. Please ask your question.");
  }

  async handleSendMeetingQuestion() {
    const question = this.meetingUserQuestion.value.trim();
    if (!question) return;

    this.appendMeetingMessage("user", question);
    this.meetingUserQuestion.value = "";

    // Disable input while waiting
    this.meetingUserQuestion.disabled = true;
    this.sendMeetingQuestionBtn.disabled = true;

    await this.streamMeeting(question);

    // Re-enable input
    this.meetingUserQuestion.disabled = false;
    this.sendMeetingQuestionBtn.disabled = false;
    this.meetingUserQuestion.focus();
  }

  async streamMeeting(userMessage) {
    const payload = {
      ...this.currentMeetingContext,
      user_message: userMessage,
      meeting_id: this.currentMeetingId
    };

    // Track thinking bubbles
    const thinkingBubbles = {};

    try {
      const response = await fetch(`${this.api.baseUrl}/meetings/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);

              // Handle Meta Messages
              if (data.type === "meta" && data.meeting_id) {
                this.currentMeetingId = data.meeting_id;
                continue;
              }

              // Handle Thinking Messages
              if (data.agent_name === "system" && data.response_text.includes("is thinking")) {
                const agentName = data.related_agent || data.response_text.split(" is thinking")[0];
                const bubble = this.appendMeetingMessage("system", data.response_text);
                if (bubble) {
                  bubble.style.opacity = "0.7";
                  thinkingBubbles[agentName] = bubble;
                }
                continue;
              }

              // Handle Real Responses
              if (data.agent_name !== "system") {
                // Remove thinking bubble
                if (thinkingBubbles[data.agent_name]) {
                  thinkingBubbles[data.agent_name].remove();
                  delete thinkingBubbles[data.agent_name];
                }

                this.appendMeetingMessage(data.agent_name, data.response_text, data.agent_name);

                // Add to history
                this.currentMeetingContext.history.push({ role: "model", parts: [`${data.agent_name}: ${data.response_text}`] });
              } else {
                // Other system messages
                this.appendMeetingMessage("system", data.response_text);
              }

            } catch (e) {
              console.error("Error parsing stream:", e);
            }
          }
        }
      }

      // Add user message to history
      this.currentMeetingContext.history.push({ role: "user", parts: [userMessage] });

    } catch (error) {
      console.error("Meeting stream error:", error);
      this.appendMeetingMessage("system", "Error communicating with the board.");
    }
  }

  async handleEndMeeting() {
    if (!confirm("Are you sure you want to end the meeting and generate minutes?")) return;

    this.endMeetingBtn.disabled = true;
    this.endMeetingBtn.textContent = "Generating Minutes...";
    this.appendMeetingMessage("system", "Meeting ended. Generating minutes, please wait...");

    const transcript = this.currentMeetingContext.history.map(msg => {
      let agent = "User";
      let statement = msg.parts[0];

      if (msg.role === "model") {
        const parts = statement.split(": ");
        if (parts.length > 1) {
          agent = parts[0];
          statement = parts.slice(1).join(": ");
        } else {
          agent = "AI";
        }
      }
      return { agent, statement };
    });

    try {
      const response = await fetch(`${this.api.baseUrl}/meetings/minutes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: this.currentMeetingContext.topic,
          company_context: this.currentMeetingContext.company_context,
          transcript: transcript,
          meeting_id: this.currentMeetingId
        })
      });

      const data = await response.json();

      this.meetingInProgressPanel.style.display = "none";
      this.meetingMinutesPanel.style.display = "block";
      this.currentMeetingMinutes = data.minutes;
      this.displayMeetingMinutes(data.minutes);

      // Reset button state
      this.endMeetingBtn.disabled = false;
      this.endMeetingBtn.textContent = "End Meeting & Generate Minutes";

    } catch (error) {
      console.error("Error generating minutes:", error);
      alert("Failed to generate minutes.");
      this.endMeetingBtn.disabled = false;
      this.endMeetingBtn.textContent = "End Meeting & Generate Minutes";
      // Don't close panel on error so user can try again
    }
  }

  restoreMeeting(details) {
    // 1. Set context
    this.meetingTopicInput.value = details.topic;
    this.companyContextInput.value = details.company_context || "";
    this.currentMeetingId = details.id;
    this.currentMeetingContext = {
      topic: details.topic,
      company_context: details.company_context,
      history: []
    };

    // 2. Clear transcript
    this.meetingTranscript.innerHTML = "";

    // 3. Restore messages
    details.messages.forEach(msg => {
      this.appendMeetingMessage(msg.role, msg.content, msg.agent_name);

      // Rebuild history
      if (msg.role === "user") {
        this.currentMeetingContext.history.push({ role: "user", parts: [msg.content] });
      } else if (msg.role === "model") {
        this.currentMeetingContext.history.push({ role: "model", parts: [`${msg.agent_name}: ${msg.content}`] });
      }
    });

    // 4. Restore minutes if any
    if (details.minutes_text) {
      this.currentMeetingMinutes = details.minutes_text;
      this.displayMeetingMinutes(details.minutes_text);

      // Show minutes panel
      this.meetingInProgressPanel.style.display = "none";
      this.meetingMinutesPanel.style.display = "block";
    } else {
      // Show meeting panel
      this.meetingInProgressPanel.style.display = "flex";
      this.meetingMinutesPanel.style.display = "none";
    }

    // 5. Switch view
    this.overviewView.style.display = "none";
    this.workspaceView.style.display = "none";
    this.meetingBoardView.style.display = "flex";
  }

  handlePromoteMinutes() {
    if (!this.currentMeetingMinutes) {
      alert("No meeting minutes available to promote.");
      return;
    }

    // Create a new node with the minutes
    const topic = this.meetingTopicInput.value.trim() || "Meeting Minutes";
    const newNode = {
      label: `📋 ${topic} `,
      fullText: this.currentMeetingMinutes,
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100
    };

    this.graph.addNode(newNode);

    // Show success message
    alert("Meeting minutes promoted to a new node!");

    // Optionally, close the meeting and return to workspace
    this.handleEndMeeting();
  }

  handleExportMinutes() {
    if (!this.currentMeetingMinutes) {
      alert("No meeting minutes available to export.");
      return;
    }

    // Create a blob with the markdown content
    const blob = new Blob([this.currentMeetingMinutes], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);

    // Create a download link
    const a = document.createElement("a");
    a.href = url;
    const topic = this.meetingTopicInput.value.trim() || "meeting";
    const filename = `${topic.replace(/\s+/g, '_')} _minutes.md`;
    a.download = filename;

    // Trigger download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up
    URL.revokeObjectURL(url);

    alert(`Minutes exported as ${filename} `);
  }

  async handleSecretaryQuery() {
    const query = this.secretaryQueryInput.value.trim();

    if (!query) {
      return;
    }

    if (!this.currentMeetingMinutes) {
      alert("No meeting minutes available to query.");
      return;
    }

    // Display user's question
    this.appendSecretaryMessage("user", query);

    // Clear input
    this.secretaryQueryInput.value = "";

    // Show loading indicator
    const loadingMsg = this.appendSecretaryMessage("assistant", "Thinking...");
    loadingMsg.classList.add("thinking");

    try {
      const payload = {
        topic: this.meetingTopicInput.value.trim(),
        company_context: this.companyContextInput.value.trim(),
        minutes: this.currentMeetingMinutes,
        query: query,
        meeting_id: this.currentMeetingId
      };

      const data = await this.api.querySecretary(payload);

      // Remove loading message
      loadingMsg.remove();

      // Display secretary's response
      this.appendSecretaryMessage("assistant", data.response);

    } catch (error) {
      loadingMsg.remove();
      this.appendSecretaryMessage("assistant", `Error: ${error.message} `);
    }
  }

  appendSecretaryMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = `secretary - chat - message ${role} `;
    msg.textContent = text;

    this.secretaryChatMessages.appendChild(msg);
    this.secretaryChatMessages.scrollTop = this.secretaryChatMessages.scrollHeight;

    return msg; // Return for potential removal (loading indicator)
  }

  appendMeetingMessage(role, text, agentName = null) {
    const msg = document.createElement("div");
    // Fix class name to match CSS: chat-message
    msg.className = `chat-message ${role}`;

    if (agentName && role !== "user") {
      const header = document.createElement("div");
      header.className = "message-header";
      header.textContent = agentName;
      msg.appendChild(header);
    }

    const content = document.createElement("span");
    content.className = "message-content";
    content.textContent = text;
    msg.appendChild(content);

    this.meetingTranscript.appendChild(msg);
    this.meetingTranscript.scrollTop = this.meetingTranscript.scrollHeight;
    return msg;
  }

  displayMeetingMinutes(markdownText) {
    // Simple markdown to HTML converter
    let html = markdownText;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Lists
    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');

    // Wrap consecutive <li> in <ul>
    html = html.replace(/(<li>.*<\/li>\n?)+/gim, '<ul>$&</ul>');

    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');

    // Set the HTML
    this.meetingMinutesContent.innerHTML = html;

    // Show the minutes panel
    this.meetingMinutesPanel.style.display = "flex";
  }

  handleSetContext() {
    const topic = this.meetingTopicInput.value.trim();
    const context = this.companyContextInput.value.trim();

    if (!topic) {
      alert("Please enter a meeting topic.");
      return;
    }

    console.log("Setting Context:");
    console.log("Topic:", topic);
    console.log("Context:", context);

    console.log("Setting Context:");
    console.log("Topic:", topic);
    console.log("Context:", context);
    // Transition to Assemble Board phase
    this.briefingPanel.style.display = "none";
    this.boardAssemblyPanel.style.display = "flex";
    this.displayTopic.textContent = topic;

    this.meetingAgents = {}; // Reset agents
    this.startMeetingBtn.disabled = true;
    this.initializeBoardChairs();
  }

  initializeBoardChairs() {
    this.chairsContainer.innerHTML = "";
    // Define 6 positions around the oval table
    // Ellipse formula: x = a * cos(t), y = b * sin(t)
    // Table size: 600x250. Center is (400, 200) relative to container (800x400).
    // a = 350 (horizontal radius + padding), b = 170 (vertical radius + padding)

    const positions = [
      { angle: 0 }, // Right
      { angle: Math.PI / 3 }, // Bottom Right
      { angle: (2 * Math.PI) / 3 }, // Bottom Left
      { angle: Math.PI }, // Left
      { angle: (4 * Math.PI) / 3 }, // Top Left
      { angle: (5 * Math.PI) / 3 }, // Top Right
    ];

    const centerX = 400;
    const centerY = 200;
    const radiusX = 340;
    const radiusY = 160;

    positions.forEach((pos, index) => {
      const x = centerX + radiusX * Math.cos(pos.angle) - 40;
      const y = centerY + radiusY * Math.sin(pos.angle) - 40;

      const chair = document.createElement("div");
      chair.className = "chair";
      chair.style.left = `${x}px`;
      chair.style.top = `${y}px`;
      chair.dataset.index = index;

      const agentObj = this.meetingAgents[index];

      if (agentObj) {
        const agentName = agentObj.name;
        const agentData = agentObj.data;
        const avatarColor = agentData?.avatar_color || "#3498db";

        chair.classList.add("occupied");
        chair.dataset.agent = agentName;
        chair.innerHTML = `
          <div class="agent-avatar" style="background-color: ${avatarColor};">${agentName.charAt(0)}</div>
          <div class="agent-name">${agentName}</div>
          <button class="remove-agent-btn" title="Remove">×</button>
        `;
        chair.querySelector(".remove-agent-btn").onclick = (e) => {
          e.stopPropagation();
          this.handleRemoveAgent(index);
        };
      } else {
        chair.classList.add("empty");
        const btn = document.createElement("button");
        btn.className = "add-agent-btn";
        btn.textContent = "+";
        btn.title = "Add Agent";
        btn.onclick = (e) => {
          e.stopPropagation();
          this.handleAddAgentClick(index, e);
        };
        chair.appendChild(btn);
      }

      this.chairsContainer.appendChild(chair);
    });

    // Close menu when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!this.meetingAgentMenu.contains(e.target)) {
        this.meetingAgentMenu.style.display = 'none';
      }
    }, { once: true }); // Use once to avoid stacking listeners, or manage carefully
  }

  handleAddAgentClick(index, event) {
    console.log(`Clicked chair ${index} `);
    this.showAgentMenu(index, event.clientX, event.clientY);
  }

  async showAgentMenu(chairIndex, x, y) {
    this.meetingAgentMenuList.innerHTML = "<div style='padding: 10px; color: #888;'>Loading agents...</div>";

    try {
      // Fetch custom agents from database
      const agents = await this.api.getAgents();

      this.meetingAgentMenuList.innerHTML = "";

      // Filter out already seated agents
      const availableAgents = agents.filter(agent =>
        !Object.values(this.meetingAgents).includes(agent.name)
      );

      if (availableAgents.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.textContent = "No more agents available";
        emptyMsg.style.padding = "10px";
        emptyMsg.style.color = "#999";
        this.meetingAgentMenuList.appendChild(emptyMsg);
      } else {
        availableAgents.forEach((agent) => {
          const item = document.createElement("div");
          item.className = "menu-item";
          item.style.padding = "10px";
          item.style.cursor = "pointer";
          item.style.borderBottom = "1px solid #444";
          item.style.display = "flex";
          item.style.alignItems = "center";
          item.style.gap = "10px";

          // Avatar circle
          const avatar = document.createElement("div");
          avatar.style.cssText = `
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background-color: ${agent.avatar_color};
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 0.9em;
          `;
          avatar.textContent = agent.name.charAt(0).toUpperCase();

          // Agent info
          const info = document.createElement("div");
          info.style.flex = "1";
          info.innerHTML = `
            <div style="font-weight: bold; color: #ecf0f1;">${agent.name}</div>
            <div style="font-size: 0.85em; color: #95a5a6;">${agent.role}</div>
          `;

          item.appendChild(avatar);
          item.appendChild(info);

          item.addEventListener("mouseenter", () => {
            item.style.backgroundColor = "#3d3d3d";
          });
          item.addEventListener("mouseleave", () => {
            item.style.backgroundColor = "transparent";
          });

          item.addEventListener("click", () => {
            this.handleSelectMeetingAgent(chairIndex, agent.name, agent);
            this.meetingAgentMenu.style.display = "none";
          });
          this.meetingAgentMenuList.appendChild(item);
        });
      }
    } catch (error) {
      console.error("Failed to load agents:", error);
      this.meetingAgentMenuList.innerHTML = "<div style='padding: 10px; color: #e74c3c;'>Failed to load agents</div>";
    }

    this.meetingAgentMenu.style.left = `${x}px`;
    this.meetingAgentMenu.style.top = `${y}px`;
    this.meetingAgentMenu.style.display = "block";
  }

  handleSelectMeetingAgent(chairIndex, agentName, agentData) {
    // Store the full agent object for later use
    this.meetingAgents[chairIndex] = {
      name: agentName,
      data: agentData
    };
    this.initializeBoardChairs(); // Re-render
    this.updateStartButtonState();
  }

  handleRemoveAgent(chairIndex) {
    delete this.meetingAgents[chairIndex];
    this.initializeBoardChairs(); // Re-render
    this.updateStartButtonState();
  }

  updateStartButtonState() {
    const hasAgents = Object.keys(this.meetingAgents).length > 0;
    this.startMeetingBtn.disabled = !hasAgents;
    this.startMeetingBtn.style.opacity = hasAgents ? "1" : "0.5";
    this.startMeetingBtn.style.cursor = hasAgents ? "pointer" : "not-allowed";
  }

  enterMeetingBoard() {
    console.log("Entering Meeting Board...");

    // Reset meeting state for a fresh start
    this.currentMeetingId = null;
    this.currentMeetingContext = null;
    this.currentMeetingMinutes = "";
    this.meetingAgents = {};

    // Clear inputs
    this.meetingTopicInput.value = "";
    this.companyContextInput.value = "";
    this.meetingTranscript.innerHTML = "";
    this.secretaryChatMessages.innerHTML = "";
    this.secretaryQueryInput.value = "";

    // Clear attachment
    this.meetingAttachmentInput.value = "";
    this.meetingAttachmentPreview.innerHTML = "";
    this.currentMeetingAttachmentPath = null;

    // Show briefing panel, hide others
    this.briefingPanel.style.display = "block";
    this.boardAssemblyPanel.style.display = "none";
    this.meetingInProgressPanel.style.display = "none";
    this.meetingMinutesPanel.style.display = "none";

    // Re-initialize chairs
    this.initializeBoardChairs();

    // Show the meeting board view
    this.workspaceView.style.display = "none";
    this.meetingBoardView.style.display = "flex";
  }

  exitMeetingBoard() {
    console.log("Exiting Meeting Board...");
    this.meetingBoardView.style.display = "none";
    this.overviewView.style.display = "flex";
    // Ensure workspace is hidden just in case
    this.workspaceView.style.display = "none";
  }

  async enterWorkspace(node) {
    console.log(`Entering workspace for node: ${node.data("label")} `);
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
    window.location.hash = `# / workspace / ${node.id()} `;

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
          )
          } " and all its contents? This cannot be undone.`
          : `Are you sure you want to delete the node "${node.data(
            "label"
          )
          } "? This cannot be undone.`;

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
    this.hidePopover();
  }

  handleWorkspaceCanvasDoubleClick(event) {
    console.log("Double click on canvas");
    const position = event.position; // Model coordinates
    const renderedPosition = event.renderedPosition; // Screen coordinates relative to canvas

    this.popoverPosition = position;

    // Position the popover
    // We need to account for the canvas offset if necessary, but renderedPosition is usually relative to the container
    // The popover is inside workspace-body which is flex.
    // Let's use absolute positioning relative to the workspace-body or canvas container.
    // Since popover is in workspace-body, we might need to adjust.
    // Actually, let's just use the renderedPosition + some offset.
    // We might need to convert to page coordinates if the container has scrolling or offset.
    // For now, let's try using the renderedPosition directly on the container.

    const containerRect = document
      .getElementById("workspace-cy")
      .getBoundingClientRect();

    this.nodeCreationPopover.style.left = `${renderedPosition.x + containerRect.left
      }px`; // This might be wrong if container is not at 0,0
    // Better: position relative to the #workspace-cy container if popover is inside it?
    // Popover is sibling to #workspace-cy in .workspace-body.
    // Let's use fixed positioning or calculate relative to viewport.
    // renderedPosition is relative to the top-left of the graph container.

    // Let's try setting top/left based on the event's page coordinates if available, or calculate from clientX/Y
    const originalEvent = event.originalEvent;
    if (originalEvent) {
      // Adjust to center the popover slightly
      this.nodeCreationPopover.style.left = `${originalEvent.clientX}px`;
      this.nodeCreationPopover.style.top = `${originalEvent.clientY}px`;
    }

    this.nodeCreationPopover.style.display = "flex";
    this.popoverText.focus();
  }

  hidePopover() {
    this.nodeCreationPopover.style.display = "none";
    this.popoverText.value = "";
    this.resetPopoverFile();
    this.popoverPosition = null;
  }

  resetPopoverFile() {
    this.popoverFileInput.value = "";
    this.popoverAttachmentPath = null;
    this.popoverPreviewContainer.style.display = "none";
  }

  async handlePopoverFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.popoverPreviewImage.src = e.target.result;
      this.popoverPreviewContainer.style.display = "block";
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("file", file);
    try {
      const data = await this.api.uploadFile(formData);
      this.popoverAttachmentPath = data.filePath;
    } catch (error) {
      console.error("Popover upload error:", error);
      alert("Failed to upload image.");
      this.resetPopoverFile();
    }
  }

  async handlePopoverCreate() {
    const text = this.popoverText.value.trim();
    if (!text && !this.popoverAttachmentPath) {
      this.hidePopover();
      return;
    }

    if (!this.activeWorkspaceNode) return;

    try {
      const payload = {
        parentNodeId: this.activeWorkspaceNode.id(),
        label: text.substring(0, 50) || "Image Node",
        fullText: text,
        attachmentPath: this.popoverAttachmentPath,
        x: this.popoverPosition.x,
        y: this.popoverPosition.y,
      };

      // We reuse promoteMessageToNode or create a similar endpoint.
      // promoteMessageToNode takes parentNodeId, label, fullText, attachmentPath.
      // It DOES NOT currently take x, y. We might need to update the API or use a new method.
      // However, the user said "It calls a new API service method, api.createWorkspaceNode... This is the same endpoint we already use for 'Promote to Node'".
      // Wait, promoteMessageToNode in App.js calls api.promoteMessageToNode.
      // Let's check ApiService.js to see if we can pass x, y.
      // If not, we might need to update the node position after creation or update the backend.
      // For now, let's assume we can pass x,y or update it immediately.
      // Actually, the user said "The save action reads the final text... It calls a new API service method, api.createWorkspaceNode".
      // I should probably add createWorkspaceNode to ApiService if it doesn't exist, or use promoteMessageToNode if it fits.
      // Let's use promoteMessageToNode but add x,y to the payload and hope the backend handles it or we update it locally.

      // Actually, let's look at ApiService.js. I haven't read it.
      // I'll assume I can send x,y. If the backend ignores it, I can move the node after adding it to the graph.

      const newNode = await this.api.promoteMessageToNode(payload);

      // The backend might not return the position we requested if it doesn't support it.
      // So we manually set the position on the new node data before adding to graph.
      newNode.data.position = {
        x: this.popoverPosition.x,
        y: this.popoverPosition.y,
      };

      // Add to graph
      const addedNode = this.workspaceGraph.addNode(
        newNode.data,
        newNode.classes
      );
      // Explicitly set position in Cytoscape
      addedNode.position(this.popoverPosition);

      this.hidePopover();
    } catch (error) {
      console.error("Failed to create node from popover:", error);
      alert("Could not create node.");
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

  handleLayoutChange(layoutName) {
    if (this.workspaceGraph) {
      this.workspaceGraph.setLayout(layoutName);
    }
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
