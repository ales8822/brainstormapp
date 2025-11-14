// frontend/js/components/IdeaWorkspace.js

class IdeaWorkspace {
  constructor(apiService) {
    console.log("IdeaWorkspace: Initializing...");
    this.api = apiService;
    this.isOpen = false;
    this.currentNode = null;
    this.conversationHistory = [];
    this.participants = [];
    this.availableModels = [];
    // DOM Element References
    this.mentionMenu = document.getElementById("mention-menu");
    this.modal = document.getElementById("idea-modal");
    this.title = document.getElementById("modal-title");
    this.generatedBy = document.getElementById("modal-generated-by");
    this.attachmentContainer = document.getElementById(
      "modal-attachment-container"
    );
    this.attachmentImage = document.getElementById("modal-attachment-image");
    this.textContent = document.getElementById("modal-text-content");
    this.participantList = document.getElementById("participant-list");
    this.addParticipantButton = document.getElementById(
      "add-participant-button"
    );
    this.addParticipantMenu = document.getElementById("add-participant-menu");
    this.participantMenuList = document.getElementById("participant-menu-list");
    this.chatMessages = document.getElementById("chat-messages");
    this.chatForm = document.getElementById("chat-form");
    this.chatInput = document.getElementById("chat-input");
    this.closeButton = document.getElementById("modal-close-button");
    this.deleteButton = document.getElementById("modal-delete-button");
    this.statusButtonsContainer = document.querySelector(".status-controls");

    this.onNodeDeletedCallback = null;

    this._addEventListeners();
    console.log("IdeaWorkspace: Initialized.");
  }

  _addEventListeners() {
    this.closeButton.addEventListener("click", () => this.close());
    this.deleteButton.addEventListener("click", () => this._deleteNode());
    this.chatForm.addEventListener("submit", (e) => this._sendMessage(e));
    this.statusButtonsContainer.addEventListener("click", (e) => {
      if (e.target.classList.contains("status-btn")) {
        this._updateStatus(e.target.dataset.status);
      }
    });
    this.chatInput.addEventListener("input", (e) =>
      this._handleMentionInput(e)
    );
    this.addParticipantButton.addEventListener("click", (e) =>
      this._showAddParticipantMenu(e)
    );

    document.addEventListener("click", (e) => {
      if (
        !this.addParticipantMenu.contains(e.target) &&
        e.target !== this.addParticipantButton
      ) {
        this.addParticipantMenu.style.display = "none";
      }
    });

    this.participantList.addEventListener("click", (e) => {
      if (e.target.classList.contains("remove-participant-btn")) {
        const modelName = e.target.dataset.model;
        this._removeParticipant(modelName);
      }
    });
  }

  setAvailableModels(models) {
    this.availableModels = models;
    console.log(
      "IdeaWorkspace: Updated available models:",
      this.availableModels
    );
  }

  async open(node) {
    console.log(`IdeaWorkspace: Opening for node ID: ${node.id()}`);
    this.currentNode = node;

    this._initializeParticipants();
    this.modal.style.display = "flex";
    this.isOpen = true;

    this.title.textContent = this.currentNode.data("label");
    this._renderProvenance();
    this._renderAttachment();
    this._renderTextContent();
    this._updateStatusButtons();

    await this._loadChatHistory();
  }

  close() {
    console.log("IdeaWorkspace: Closing...");
    this.modal.style.display = "none";
    this.isOpen = false;
    this.currentNode = null;
    this.conversationHistory = [];
  }

  _initializeParticipants() {
    console.log(
      "IdeaWorkspace: Initializing participants from available list..."
    );
    const generatedBy = this.currentNode.data("generated_by");
    if (generatedBy && this.availableModels.includes(generatedBy)) {
      this.participants = [generatedBy];
    } else {
      this.participants =
        this.availableModels.length > 0 ? [this.availableModels[0]] : [];
    }
    if (this.participants.length === 0) {
      console.warn("No available models to set as default participant.");
    }
    this._renderParticipants();
  }

  _renderParticipants() {
    console.log("IdeaWorkspace: Rendering participants:", this.participants);
    this.participantList.innerHTML = "";
    this.participants.forEach((modelName) => {
      const tag = document.createElement("div");
      tag.className = "participant-tag";
      tag.dataset.modelTag = modelName;
      tag.textContent = modelName.split(":")[0];
      const removeBtn = document.createElement("span");
      removeBtn.className = "remove-participant-btn";
      removeBtn.dataset.model = modelName;
      removeBtn.innerHTML = "&times;";
      tag.appendChild(removeBtn);
      this.participantList.appendChild(tag);
    });
  }

  _showAddParticipantMenu(event) {
    event.stopPropagation();
    const modelsToAdd = this.availableModels.filter(
      (m) => !this.participants.includes(m)
    );
    this.participantMenuList.innerHTML = "";
    if (modelsToAdd.length === 0) {
      const noModelsItem = document.createElement("div");
      noModelsItem.textContent = "No other models available.";
      noModelsItem.style.padding = "10px 15px";
      noModelsItem.style.color = "#6c757d";
      this.participantMenuList.appendChild(noModelsItem);
    } else {
      modelsToAdd.forEach((modelName) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = modelName;
        checkbox.addEventListener("change", (e) => {
          if (e.target.checked) {
            this._addParticipant(e.target.value);
          }
          this.addParticipantMenu.style.display = "none";
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(modelName));
        this.participantMenuList.appendChild(label);
      });
    }
    const buttonRect = this.addParticipantButton.getBoundingClientRect();
    this.addParticipantMenu.style.left = `${
      buttonRect.right - this.addParticipantMenu.offsetWidth
    }px`;
    this.addParticipantMenu.style.top = `${buttonRect.bottom + 5}px`;
    this.addParticipantMenu.style.display = "block";
  }

  _addParticipant(modelName) {
    if (!this.participants.includes(modelName)) {
      this.participants.push(modelName);
      this._renderParticipants();
    }
  }

  _removeParticipant(modelName) {
    if (this.participants.length <= 1) {
      alert("You must have at least one participant in the chat.");
      return;
    }
    this.participants = this.participants.filter((p) => p !== modelName);
    this._renderParticipants();
  }

  _renderProvenance() {
    const generatedByText = this.currentNode.data("generated_by");
    this.generatedBy.textContent = generatedByText
      ? `Generated by: ${generatedByText}`
      : "";
    this.generatedBy.style.display = generatedByText ? "block" : "none";
  }

  _renderAttachment() {
    const path = this.currentNode.data("attachment_path");
    if (path) {
      this.attachmentImage.src = path;
      this.attachmentContainer.style.display = "block";
    } else {
      this.attachmentContainer.style.display = "none";
    }
  }

  _renderTextContent() {
    const text = this.currentNode.data("fullText");
    if (text && text.trim() !== "") {
      this.textContent.textContent = text;
      this.textContent.style.display = "block";
    } else {
      this.textContent.style.display = "none";
    }
  }

  async _loadChatHistory() {
    this.chatMessages.innerHTML = "";
    try {
      this.conversationHistory = await this.api.getChatHistory(
        this.currentNode.id()
      );
      this.conversationHistory.forEach((msg) => {
        this._appendChatMessage(msg.parts[0], msg.role, msg.generated_by);
      });
    } catch (error) {
      console.error("IdeaWorkspace: Failed to load chat history.", error);
    }
  }

  async _sendMessage(event) {
    event.preventDefault();
    event.stopPropagation();

    let userMessage = this.chatInput.value.trim();
    if (!userMessage) return;

    // --- NEW: Parse for a target model ---
    let targetModel = null;
    let messageToDisplay = userMessage; // This is what the user sees in the chat

    if (userMessage.startsWith("@")) {
      const words = userMessage.split(" ");
      const mention = words[0];
      const modelName = mention.substring(1);

      // Check if the mention is a valid, current participant
      if (this.participants.includes(modelName)) {
        targetModel = modelName;
        // The message sent to the AI should not include the @mention
        userMessage = words.slice(1).join(" ");
        console.log(
          `Directed Message: Targeting '${targetModel}' with message: "${userMessage}"`
        );

        // If the user only typed the @mention and nothing else, stop.
        if (!userMessage) {
          alert("Please type a message after the @mention.");
          return;
        }
      }
    }
    // --- END OF NEW LOGIC ---

    // Append the full message (including the @mention) to the user's chat window
    this._appendChatMessage(messageToDisplay, "user");
    this.chatInput.value = "";
    const submitButton = this.chatForm.querySelector("button");
    submitButton.disabled = true;

    // Update UI for the models that will be called
    if (targetModel) {
      this._updateParticipantTag(targetModel, "thinking");
    } else {
      this._updateAllParticipantTags("thinking");
    }

    // Use the potentially modified userMessage (without the @mention) for history
    this.conversationHistory.push({ role: "user", parts: [userMessage] });

    try {
      const payload = {
        nodeId: this.currentNode.id(),
        nodeContext: this.currentNode.data("fullText"),
        attachmentPath: this.currentNode.data("attachment_path"),
        history: this.conversationHistory,
        userMessage: userMessage, // Send the cleaned message
        participants: this.participants,
        targetModel: targetModel, // Send the target, which is null for a broadcast
      };

      const response = await fetch(`${this.api.baseUrl}/group-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Group chat request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const jsonObjects = chunk.split("\n").filter((s) => s.trim() !== "");
        for (const jsonObjStr of jsonObjects) {
          try {
            const data = JSON.parse(jsonObjStr);
            console.log("Received streamed response from", data.model_name);
            this._appendChatMessage(data.response, "model", data.model_name);
            this._updateParticipantTag(data.model_name, "responded");
            this.conversationHistory.push({
              role: "model",
              parts: [data.response],
              generated_by: data.model_name,
            });
          } catch (e) {
            console.error("Error parsing streamed JSON:", e, jsonObjStr);
          }
        }
      }
    } catch (error) {
      console.error("Group Chat error:", error);
      this._appendChatMessage(
        `Sorry, network error: ${error.message}`,
        "model",
        "system-error"
      );
    } finally {
      submitButton.disabled = false;
      // Only clear the tags of models that were actually called
      if (targetModel) {
        this._updateParticipantTag(targetModel, "");
      } else {
        this._updateAllParticipantTags("");
      }
    }
  }

  _updateParticipantTag(modelName, statusClass) {
    const tag = this.participantList.querySelector(
      `[data-model-tag="${modelName}"]`
    );
    if (tag) {
      tag.className = "participant-tag";
      if (statusClass) {
        tag.classList.add(statusClass);
      }
    }
  }

  _updateAllParticipantTags(statusClass) {
    this.participantList.querySelectorAll(".participant-tag").forEach((tag) => {
      tag.className = "participant-tag";
      if (statusClass) {
        tag.classList.add(statusClass);
      }
    });
  }

  _appendChatMessage(text, role, modelName = null) {
    const messageContainer = document.createElement("div");
    messageContainer.classList.add("chat-message", role);
    if (role === "model" && modelName) {
      const header = document.createElement("div");
      header.classList.add("message-header");
      header.textContent = modelName;
      messageContainer.appendChild(header);
    }
    const content = document.createElement("div");
    content.textContent = text;
    messageContainer.appendChild(content);
    this.chatMessages.appendChild(messageContainer);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  async _updateStatus(newStatus) {
    if (!this.currentNode) return;
    try {
      await this.api.updateNodeStatus(this.currentNode.id(), newStatus);
      this.currentNode.data("status", newStatus);
      const baseClass = this.currentNode.hasClass("user-node")
        ? "user-node"
        : "ai-node";
      const attachmentClass = this.currentNode.hasClass("has-attachment")
        ? " has-attachment"
        : "";
      this.currentNode.classes(
        `${baseClass} status-${newStatus}${attachmentClass}`
      );
      this._updateStatusButtons();
    } catch (error) {
      console.error("Failed to update status.", error);
      alert("Could not update status.");
    }
  }

  _updateStatusButtons() {
    const currentStatus = this.currentNode.data("status");
    this.statusButtonsContainer
      .querySelectorAll(".status-btn")
      .forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.status === currentStatus);
      });
  }

  async _deleteNode() {
    if (!this.currentNode) return;
    if (confirm("Delete this node and all its children?")) {
      try {
        await this.api.deleteNode(this.currentNode.id());
        this.close();
        if (this.onNodeDeletedCallback) {
          this.onNodeDeletedCallback();
        }
      } catch (error) {
        console.error("Failed to delete node.", error);
        alert("Could not delete node branch.");
      }
    }
  }

  _handleMentionInput(event) {
    const text = event.target.value;
    const lastWord = text.split(" ").pop();

    if (lastWord.startsWith("@") && this.participants.length > 1) {
      const searchTerm = lastWord.substring(1).toLowerCase();
      const matchingParticipants = this.participants.filter((p) =>
        p.toLowerCase().includes(searchTerm)
      );
      this._showMentionMenu(matchingParticipants);
    } else {
      this.mentionMenu.style.display = "none";
    }
  }

  _showMentionMenu(participants) {
    this.mentionMenu.innerHTML = "";
    if (participants.length === 0) {
      this.mentionMenu.style.display = "none";
      return;
    }
    participants.forEach((modelName) => {
      const item = document.createElement("div");
      item.textContent = modelName;
      item.className = "mention-item"; // We'll need to style this
      item.onclick = () => this._insertMention(modelName);
      this.mentionMenu.appendChild(item);
    });
    const inputRect = this.chatInput.getBoundingClientRect();
    this.mentionMenu.style.left = `${inputRect.left}px`;
    this.mentionMenu.style.bottom = `${
      window.innerHeight - inputRect.top + 5
    }px`;
    this.mentionMenu.style.display = "block";
  }

  _insertMention(modelName) {
    const text = this.chatInput.value;
    const words = text.split(" ");
    words.pop(); // Remove the partial @mention
    this.chatInput.value =
      words.join(" ") + (words.length > 0 ? " " : "") + `@${modelName} `;
    this.chatInput.focus();
    this.mentionMenu.style.display = "none";
  }
}
