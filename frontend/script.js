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

// === CONFIG & APP STATE ===
const API_BASE_URL = "http://127.0.0.1:8000/api";
let selectedNode = null;
let activeConversationHistory = [];

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
    const elements = await response.json();
    cy.elements().remove();
    elements.forEach((el) => {
      if (el.group === "nodes" && el.data.status) {
        el.classes += ` status-${el.data.status}`;
      }
    });
    cy.add(elements);
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
  const generatedBy = selectedNode.data("generated_by");
  if (generatedBy) {
    modalGeneratedBy.textContent = `Generated by: ${generatedBy}`;
    modalGeneratedBy.style.display = "block";
  } else {
    modalGeneratedBy.style.display = "none";
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
    activeConversationHistory = [];
    chatMessages.innerHTML =
      '<div class="chat-message model">Could not load history.</div>';
  }
  modalTitle.innerText = selectedNode.data("label");
  modalTextContent.innerText = selectedNode.data("fullText");
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
submitButton.addEventListener("click", async () => {
  const promptText = promptInput.value;
  if (!promptText.trim()) {
    alert("Please enter some text!");
    return;
  }
  loader.style.display = "block";
  submitButton.disabled = true;
  let apiContext = null;
  let sourceNodeId = null;
  if (selectedNode) {
    sourceNodeId = selectedNode.id();
    apiContext = selectedNode.data("fullText");
  } else {
    sourceNodeId = `node-user-${uuid_v4()}`;
    cy.add({
      group: "nodes",
      data: {
        id: sourceNodeId,
        label: promptText,
        fullText: promptText,
        status: "Idea",
      },
      classes: "user-node status-Idea",
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
      }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "API request failed");
    }
    const data = await response.json();
    if (selectedNode) {
      sourceNodeId = data.user_node_id;
    }
    // We get the model name from the service, but we don't have it here. The backend saves it.
    // We will get it on the next graph load or when opening the modal.
    cy.add([
      {
        group: "nodes",
        data: {
          id: data.ai_node.id,
          label: data.ai_node.label,
          fullText: data.ai_node.fullText,
          status: "Idea" /* generated_by will be loaded on refresh */,
        },
        classes: "ai-node status-Idea",
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
  }
});

// === INITIALIZE APP ===
loadGraph();
updateActiveModelDisplay();
