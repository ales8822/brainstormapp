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
    return this._fetch("/graph/workspace/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_node_id: payload.parentNodeId,
        label: payload.label,
        full_text: payload.fullText,
        // --- FIX: Use snake_case to match the backend schema ---
        attachment_path: payload.attachmentPath,
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

  async streamGroupChat(payload, onData, onComplete) {
    try {
      const response = await fetch(`${this.baseUrl}/group-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ""; // Buffer to hold incomplete lines

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          // Process any remaining text in the buffer
          if (buffer.trim()) {
            try {
              onData(JSON.parse(buffer));
            } catch (e) {
              console.error("Error parsing final stream chunk:", buffer, e);
            }
          }
          break;
        }

        // Add the new chunk to the buffer
        buffer += decoder.decode(value, { stream: true });

        // Process all complete lines in the buffer
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line) {
            try {
              onData(JSON.parse(line));
            } catch (e) {
              console.error("Error parsing stream line:", line, e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Streaming API call failed:", error);
      onData({ error: error.message });
    } finally {
      if (onComplete) {
        onComplete();
      }
    }
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
