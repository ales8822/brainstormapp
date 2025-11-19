// frontend/js/services/ApiService.js

// (The Communicator)**
//
// This class will handle all `fetch` calls. It has no knowledge of the UI.

class ApiService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    console.log(`ApiService initialized with base URL: ${this.baseUrl}`);
  }

  async _fetch(endpoint, options = {}) {
    console.log(`ApiService: Fetching from endpoint: ${endpoint}`, { options });
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: `HTTP error! Status: ${response.status}` }));
        throw new Error(errorData.detail);
      }
      return response.json();
    } catch (error) {
      console.error(`ApiService: Error fetching ${endpoint}:`, error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  // --- Graph Endpoints ---
  getGraph() {
    return this._fetch("/graph");
  }

  getWorkspaceElements(workspaceId) {
    return this._fetch(`/workspaces/${workspaceId}/elements`);
  }

  deleteNode(nodeId) {
    return this._fetch(`/nodes/${nodeId}`, { method: "DELETE" });
  }

  updateNodeStatus(nodeId, status) {
    return this._fetch(`/nodes/${nodeId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  brainstorm(payload) {
    return this._fetch("/brainstorm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  createSimpleNode(label) {
    return this._fetch("/graph/nodes/simple", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
  }

  promoteMessageToNode(payload) {
    // The payload should be { parentNodeId, label, fullText }
    return this._fetch("/graph/workspace/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_node_id: payload.parentNodeId,
        label: payload.label,
        full_text: payload.fullText,
      }),
    });
  }

  createEdge(payload) {
    // payload should be { source, target, label }
    return this._fetch("/graph/edges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  deleteEdge(payload) {
    // payload should be { source, target }
    return this._fetch("/graph/edges", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  updateNodeContent(nodeId, newText) {
    return this._fetch(`/nodes/${nodeId}/content`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_text: newText }),
    });
  }

  uploadFile(formData) {
    // Note: _fetch is not used here because FormData sets its own headers
    console.log("ApiService: Uploading file...");
    return fetch(`${this.baseUrl}/upload`, {
      method: "POST",
      body: formData,
    }).then((response) => {
      if (!response.ok) throw new Error("File upload failed.");
      return response.json();
    });
  }

  // --- Chat & Settings Endpoints ---
  getChatHistory(nodeId) {
    return this._fetch(`/nodes/${nodeId}/chat`);
  }

  sendMessage(payload) {
    return this._fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  getSettings() {
    return this._fetch("/settings");
  }

  saveSettings(settings) {
    return this._fetch("/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  }

  getOllamaModels() {
    return this._fetch("/ollama/models");
  }
}
