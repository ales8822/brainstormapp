// === DOM ELEMENT REFERENCES ===
const promptInput = document.getElementById("prompt-input"),
  submitButton = document.getElementById("submit-button"),
  loader = document.getElementById("loader"),
  cyContainer = document.getElementById("cy"),
  promptLabel = document.getElementById("prompt-label");
const ideaModal = document.getElementById("idea-modal"),
  modalTitle = document.getElementById("modal-title"),
  modalTextContent = document.getElementById("modal-text-content"),
  modalDeleteButton = document.getElementById("modal-delete-button"),
  modalCloseButton = document.getElementById("modal-close-button"),
  modalGeneratedBy = document.getElementById("modal-generated-by");
const statusButtonsContainer = document.querySelector(".status-controls");
const chatForm = document.getElementById("chat-form"),
  chatInput = document.getElementById("chat-input"),
  chatMessages = document.getElementById("chat-messages");
const settingsButton = document.getElementById("settings-button"),
  settingsModal = document.getElementById("settings-modal"),
  settingsCloseButton = document.getElementById("settings-close-button"),
  settingsSaveButton = document.getElementById("settings-save-button");
const providerSelect = document.getElementById("ai-provider-select"),
  geminiSettings = document.getElementById("gemini-settings"),
  runpodSettings = document.getElementById("runpod-settings");
const geminiApiKeyInput = document.getElementById("gemini-api-key"),
  runpodUrlInput = document.getElementById("runpod-url");
const ollamaModelSelect = document.getElementById("ollama-model-select"),
  refreshModelsButton = document.getElementById("refresh-models-button");
const activeModelDisplay = document.getElementById("active-model-display");
const fileInput = document.getElementById("file-input");
const attachFileButton = document.getElementById("attach-file-button");
const filePreviewContainer = document.getElementById("file-preview-container");
const filePreviewImage = document.getElementById("file-preview-image");
const removeFileButton = document.getElementById("remove-file-button");
const modalAttachmentContainer = document.getElementById(
  "modal-attachment-container"
);
const modalAttachmentImage = document.getElementById("modal-attachment-image");

// === CONFIG & APP STATE ===
const API_BASE_URL = "http://127.0.0.1:8000/api";
let selectedNode = null;
let activeConversationHistory = [];
let attachedFilePath = null;
// === HELPER FUNCTION ===
function uuid_v4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// === SETTINGS FUNCTIONS ===
async function updateActiveModelDisplay() {
  try {
    const response = await fetch(`${API_BASE_URL}/settings`);
    const settings = await response.json();
    const provider = settings.ai_provider || "gemini";
    let modelText = "Gemini";
    if (provider === "runpod") {
      modelText = settings.ollama_model_name || "Not Set";
    }
    activeModelDisplay.textContent = `Active AI: ${modelText}`;
  } catch {
    activeModelDisplay.textContent = "Active AI: Unknown";
  }
}
async function openSettingsModal() {
  try {
    const response = await fetch(`${API_BASE_URL}/settings`);
    const settings = await response.json();
    providerSelect.value = settings.ai_provider || "gemini";
    geminiApiKeyInput.value = settings.gemini_api_key || "";
    runpodUrlInput.value = settings.runpod_url || "";
    await refreshOllamaModels(settings.ollama_model_name);
    toggleProviderSettings();
    settingsModal.style.display = "flex";
  } catch (error) {
    console.error("Failed to load settings:", error);
    alert("Could not load settings from the server.");
  }
}
function closeSettingsModal() {
  settingsModal.style.display = "none";
}
function toggleProviderSettings() {
  const provider = providerSelect.value;
  geminiSettings.style.display = provider === "gemini" ? "block" : "none";
  runpodSettings.style.display = provider === "runpod" ? "block" : "none";
}
async function saveSettings() {
  const settingsToSave = {
    ai_provider: providerSelect.value,
    gemini_api_key: geminiApiKeyInput.value.trim(),
    runpod_url: runpodUrlInput.value.trim(),
    ollama_model_name: ollamaModelSelect.value,
  };
  try {
    await fetch(`${API_BASE_URL}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settingsToSave),
    });
    alert("Settings saved successfully!");
    closeSettingsModal();
    updateActiveModelDisplay();
  } catch (error) {
    console.error("Failed to save settings:", error);
    alert("Could not save settings. Please check the backend server.");
  }
}
async function refreshOllamaModels(selectedValue = null) {
  const runpodUrl = runpodUrlInput.value.trim();
  if (providerSelect.value !== "runpod" || !runpodUrl) {
    ollamaModelSelect.innerHTML =
      '<option value="">-- Enter a URL first --</option>';
    return;
  }
  ollamaModelSelect.innerHTML =
    '<option value="">-- Loading models... --</option>';
  refreshModelsButton.disabled = true;
  try {
    await fetch(`${API_BASE_URL}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runpod_url: runpodUrl }),
    });
    const response = await fetch(`${API_BASE_URL}/ollama/models`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Failed to fetch models.");
    }
    const data = await response.json();
    ollamaModelSelect.innerHTML = "";
    if (data.models && data.models.length > 0) {
      data.models.forEach((modelName) => {
        const option = document.createElement("option");
        option.value = modelName;
        option.textContent = modelName;
        ollamaModelSelect.appendChild(option);
      });
      ollamaModelSelect.value = selectedValue || data.models[0];
    } else {
      ollamaModelSelect.innerHTML =
        '<option value="">-- No models found on server --</option>';
    }
  } catch (error) {
    console.error("Failed to refresh Ollama models:", error);
    ollamaModelSelect.innerHTML = `<option value="">-- Error: ${error.message} --</option>`;
  } finally {
    refreshModelsButton.disabled = false;
  }
}

// === CYTOSCAPE & CORE APP FUNCTIONS ===
const cy = cytoscape({
  container: cyContainer,
  style: [
    {
      selector: "node",
      style: {
        label: "data(label)",
        width: "150px",
        height: "150px",
        "text-valign": "center",
        "text-halign": "center",
        "text-wrap": "wrap",
        "text-max-width": "140px",
        color: "#fff",
        "font-size": "14px",
        "font-weight": "bold",
        "transition-property": "background-color, shape",
        "transition-duration": "0.3s",
      },
    },
    {
      selector: ":selected",
      style: {
        "border-color": "#f1c40f",
        "border-width": 5,
        "border-style": "solid",
      },
    },
    { selector: ".user-node", style: { shape: "round-rectangle" } },
    { selector: ".ai-node", style: { shape: "ellipse" } },
    { selector: ".status-Idea", style: { "background-color": "#3498db" } },
    {
      selector: ".status-InProgress",
      style: { "background-color": "#f39c12" },
    },
    { selector: ".status-Completed", style: { "background-color": "#27ae60" } },
    { selector: ".status-Archived", style: { "background-color": "#95a5a6" } },
    {
      selector: "edge",
      style: {
        width: 3,
        "line-color": "#bdc3c7",
        "target-arrow-color": "#bdc3c7",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
      },
    },
    {
      selector: "edge[label]",
      style: {
        label: "data(label)",
        "font-size": "10px",
        color: "#34495e",
        "text-rotation": "autorotate",
        "text-background-color": "#ecf0f1",
        "text-background-opacity": 1,
        "text-background-padding": "3px",
      },
    },
  ],
  elements: [],
});

cy.on("tap", "node", (event) => {
  selectedNode = event.target;
  openModal();
});

cy.on("tap", (event) => {
  // If the click is on the background canvas, deselect everything
  if (event.target === cy) {
    if (selectedNode) {
      selectedNode.unselect();
      selectedNode = null;
    }
    updatePromptUI();
  }
});

async function loadGraph() {
  try {
    const response = await fetch(`${API_BASE_URL}/graph`);
    const elementsFromServer = await response.json();
    cy.elements().remove();

    // --- THE DEFINITIVE FIX ---
    // We must process the data BEFORE adding it to Cytoscape.
    const processedElements = elementsFromServer.map((el) => {
      if (el.group === "nodes") {
        let classes = el.classes || ""; // Start with base classes from backend

        // Add status class
        if (el.data.status) {
          classes += ` status-${el.data.status}`;
        }

        // Add attachment class
        if (el.data.attachment_path) {
          classes += " has-attachment";
        }

        // Assign the processed classes back to the element object
        el.classes = classes.trim();
      }
      return el;
    });

    cy.add(processedElements); // Add the fully processed elements
    cy.layout({ name: "cose", animate: false, padding: 50 }).run();
  } catch (error) {
    console.error("Failed to load graph:", error);
  }
}

async function updateNodeStatus(newStatus) {
  if (!selectedNode) return;
  try {
    await fetch(`${API_BASE_URL}/nodes/${selectedNode.id()}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    selectedNode.data("status", newStatus);
    const baseClass = selectedNode.hasClass("user-node")
      ? "user-node"
      : "ai-node";
    selectedNode.classes(`${baseClass} status-${newStatus}`);
    updateModalStatusButtons();
  } catch (error) {
    console.error("Error updating status:", error);
    alert("Could not update status.");
  }
}
async function deleteSelectedNode() {
  if (!selectedNode) return;
  try {
    await fetch(`${API_BASE_URL}/nodes/${selectedNode.id()}`, {
      method: "DELETE",
    });
    await loadGraph();
    selectedNode = null;
    closeModal();
    updatePromptUI();
  } catch (error) {
    console.error("Error deleting node branch:", error);
    alert("Could not delete node branch.");
  }
}
async function openModal() {
  if (!selectedNode) return;
  const nodeId = selectedNode.id();

  // --- Add robust logging for final diagnosis ---
  console.log("Opening modal for node ID:", nodeId);
  console.log("Full node data object:", selectedNode.data());

  const attachmentPath = selectedNode.data("attachment_path");

  console.log("Attachment path from node data:", attachmentPath);

  if (attachmentPath) {
    modalAttachmentImage.src = attachmentPath;
    modalAttachmentContainer.style.display = "block";
  } else {
    console.log("Node has no attachment path. Hiding image container.");
    modalAttachmentContainer.style.display = "none";
  }

  // (The rest of the function is correct)
  const generatedBy = selectedNode.data("generated_by");
  if (generatedBy) {
    modalGeneratedBy.textContent = `Generated by: ${generatedBy}`;
    modalGeneratedBy.style.display = "block";
  } else {
    modalGeneratedBy.style.display = "none";
  }
  const fullText = selectedNode.data("fullText");
  if (fullText && fullText.trim() !== "") {
    modalTextContent.textContent = fullText;
    modalTextContent.style.display = "block";
  } else {
    modalTextContent.style.display = "none";
  }
  try {
    const response = await fetch(`${API_BASE_URL}/nodes/${nodeId}/chat`);
    if (!response.ok) throw new Error("Could not fetch chat history.");
    activeConversationHistory = await response.json();
    chatMessages.innerHTML = "";
    activeConversationHistory.forEach((message) => {
      appendChatMessage(message.parts[0], message.role, message.generated_by);
    });
  } catch (error) {
    console.error("Failed to load chat history:", error);
  }
  modalTitle.innerText = selectedNode.data("label");
  updateModalStatusButtons();
  ideaModal.style.display = "flex";
}

function closeModal() {
  ideaModal.style.display = "none";
}
function updateModalStatusButtons() {
  const currentStatus = selectedNode.data("status");
  document.querySelectorAll(".status-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.status === currentStatus);
  });
}

function resetFileUpload() {
  fileInput.value = ""; // Clear the file input
  attachedFilePath = null;
  filePreviewContainer.style.display = "none";
  attachFileButton.style.display = "block";
}

function updatePromptUI() {
  if (selectedNode) {
    promptLabel.innerText = "Enter a follow-up...";
    submitButton.innerText = "Brainstorm from Selected";
  } else {
    promptLabel.innerText = "Enter a new idea...";
    submitButton.innerText = "Create Idea Node";
  }
}
function appendChatMessage(text, role, modelName = null) {
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
  chatMessages.appendChild(messageContainer);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// === MAIN EVENT LISTENERS ===
settingsButton.addEventListener("click", openSettingsModal);
settingsCloseButton.addEventListener("click", closeSettingsModal);
settingsSaveButton.addEventListener("click", saveSettings);
providerSelect.addEventListener("change", toggleProviderSettings);
refreshModelsButton.addEventListener("click", () =>
  refreshOllamaModels(ollamaModelSelect.value)
);
modalCloseButton.addEventListener("click", closeModal);
modalDeleteButton.addEventListener("click", deleteSelectedNode);
statusButtonsContainer.addEventListener("click", (event) => {
  if (event.target.classList.contains("status-btn")) {
    const newStatus = event.target.dataset.status;
    updateNodeStatus(newStatus);
  }
});
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const userMessage = chatInput.value;
  if (!userMessage.trim()) return;
  appendChatMessage(userMessage, "user");
  chatInput.value = "";
  const chatSubmitButton = chatForm.querySelector("button");
  chatSubmitButton.disabled = true;
  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeId: selectedNode.id(),
        nodeContext: selectedNode.data("fullText"),
        history: activeConversationHistory,
        userMessage: userMessage,
      }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail);
    }
    const data = await response.json();
    const aiMessage = data.response;
    const modelNameUsed = data.model_name;
    appendChatMessage(aiMessage, "model", modelNameUsed);
    activeConversationHistory.push({ role: "user", parts: [userMessage] });
    activeConversationHistory.push({
      role: "model",
      parts: [aiMessage],
      generated_by: modelNameUsed,
    });
  } catch (error) {
    console.error("Chat error:", error);
    appendChatMessage(
      `Sorry, an error occurred: ${error.message || "Unknown error"}`,
      "model"
    );
  } finally {
    chatSubmitButton.disabled = false;
    if (ideaModal.style.display !== "none") {
      chatInput.focus();
    }
  }
});

// submitButton listener with this correct version

submitButton.addEventListener("click", async () => {
  const promptText = promptInput.value;
  if (!promptText.trim() && !attachedFilePath) {
    alert("Please enter an idea or attach an image.");
    return;
  }

  loader.style.display = "block";
  submitButton.disabled = true;
  let apiContext = null;
  let sourceNodeId = null;

  // Store the attachment path locally before the API call
  const currentAttachmentPath = attachedFilePath;

  if (selectedNode) {
    sourceNodeId = selectedNode.id();
    apiContext = selectedNode.data("fullText");
  } else {
    sourceNodeId = `node-user-${uuid_v4()}`;
    cy.add({
      group: "nodes",
      data: {
        id: sourceNodeId,
        label: promptText || "Image Analysis",
        fullText: promptText,
        status: "Idea",
        attachment_path: currentAttachmentPath,
      },
      classes: `user-node status-Idea ${
        currentAttachmentPath ? "has-attachment" : ""
      }`,
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/brainstorm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: promptText,
        parent_context: apiContext,
        source_node_id: sourceNodeId,
        attachment_path: currentAttachmentPath,
      }),
    });

    if (!response.ok) {
      const err = await response
        .json()
        .catch(() => ({ detail: "API request failed." }));
      throw new Error(err.detail);
    }

    const data = await response.json();

    if (selectedNode) {
      sourceNodeId = data.user_node_id;
    }

    // --- THE DEFINITIVE FIX ---
    // When adding the new AI node, also add the attachment path
    // that was used to generate it.
    cy.add([
      {
        group: "nodes",
        data: {
          id: data.ai_node.id,
          label: data.ai_node.label,
          fullText: data.ai_node.fullText,
          status: "Idea",
          attachment_path: currentAttachmentPath, // <-- THE MISSING PIECE
        },
        // Add the has-attachment class for the icon
        classes: `ai-node status-Idea ${
          currentAttachmentPath ? "has-attachment" : ""
        }`,
      },
      {
        group: "edges",
        data: {
          id: `edge-${sourceNodeId}-${data.ai_node.id}`,
          source: sourceNodeId,
          target: data.ai_node.id,
          label: promptText,
        },
      },
    ]);

    cy.layout({ name: "cose", animate: true, padding: 50 }).run();
  } catch (error) {
    console.error("Error in brainstorming process:", error);
    alert(error.message);
    if (!selectedNode) {
      cy.getElementById(sourceNodeId).remove();
    }
  } finally {
    loader.style.display = "none";
    submitButton.disabled = false;
    promptInput.value = "";
    resetFileUpload();
  }
});

attachFileButton.addEventListener("click", () => {
  fileInput.click(); // Trigger the hidden file input
});

removeFileButton.addEventListener("click", () => {
  resetFileUpload();
});

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Show a preview
  const reader = new FileReader();
  reader.onload = (e) => {
    filePreviewImage.src = e.target.result;
    attachFileButton.style.display = "none";
    filePreviewContainer.style.display = "block";
  };
  reader.readAsDataURL(file);

  // Upload the file to the backend
  const formData = new FormData();
  formData.append("file", file);

  loader.style.display = "block"; // Use main loader for upload
  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("File upload failed.");

    const data = await response.json();
    attachedFilePath = data.filePath; // Store the returned path
    console.log("File uploaded, path:", attachedFilePath);
  } catch (error) {
    console.error("Upload error:", error);
    alert("Failed to upload image. Please try again.");
    resetFileUpload();
  } finally {
    loader.style.display = "none";
  }
});

// === INITIALIZE APP ===
loadGraph();
updateActiveModelDisplay();
