class AgentManager {
    constructor(api) {
        this.api = api;

        this.modal = document.getElementById("agent-manager-modal");
        this.listContainer = document.getElementById("agent-list");
        this.editorPanel = document.getElementById("agent-editor");
        this.closeBtn = document.getElementById("agent-manager-close-btn");
        this.openBtn = document.getElementById("agent-manager-button");
        this.newAgentBtn = document.getElementById("new-agent-btn");
        this.backToListBtn = document.getElementById("back-to-agent-list-btn");

        // Editor form fields
        this.agentForm = document.getElementById("agent-form");
        this.agentNameInput = document.getElementById("agent-name");
        this.agentRoleInput = document.getElementById("agent-role");
        this.agentInstructionsInput = document.getElementById("agent-instructions");
        this.agentModelSelect = document.getElementById("agent-model");
        this.agentColorInput = document.getElementById("agent-color");
        this.saveAgentBtn = document.getElementById("save-agent-btn");
        this.deleteAgentBtn = document.getElementById("delete-agent-btn");

        this.currentAgentId = null; // null for new, ID for editing

        this.init();
    }

    init() {
        if (this.openBtn) {
            this.openBtn.addEventListener("click", () => this.open());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener("click", () => this.close());
        }
        if (this.newAgentBtn) {
            this.newAgentBtn.addEventListener("click", () => this.showEditor());
        }
        if (this.backToListBtn) {
            this.backToListBtn.addEventListener("click", () => this.showList());
        }
        if (this.saveAgentBtn) {
            this.saveAgentBtn.addEventListener("click", () => this.saveAgent());
        }
        if (this.deleteAgentBtn) {
            this.deleteAgentBtn.addEventListener("click", () => this.deleteAgent());
        }

        // Close on click outside
        this.modal.addEventListener("click", (e) => {
            if (e.target === this.modal) this.close();
        });
    }

    async open() {
        this.modal.style.display = "flex";
        await this.loadAgents();
        this.showList();
    }

    close() {
        this.modal.style.display = "none";
    }

    showList() {
        this.listContainer.style.display = "block";
        this.editorPanel.style.display = "none";
        this.newAgentBtn.style.display = "inline-block";
        this.backToListBtn.style.display = "none";
        this.saveAgentBtn.style.display = "none";
        this.deleteAgentBtn.style.display = "none";
    }

    showEditor(agent = null) {
        this.listContainer.style.display = "none";
        this.editorPanel.style.display = "block";
        this.newAgentBtn.style.display = "none";
        this.backToListBtn.style.display = "inline-block";
        this.saveAgentBtn.style.display = "inline-block";

        if (agent) {
            // Edit mode
            this.currentAgentId = agent.id;
            this.agentNameInput.value = agent.name;
            this.agentRoleInput.value = agent.role;
            this.agentInstructionsInput.value = agent.system_instructions;
            this.agentModelSelect.value = agent.model_provider;
            this.agentColorInput.value = agent.avatar_color;
            this.deleteAgentBtn.style.display = "inline-block";
        } else {
            // New mode
            this.currentAgentId = null;
            this.agentForm.reset();
            this.agentColorInput.value = "#3498db";
            this.deleteAgentBtn.style.display = "none";
        }
    }

    async loadAgents() {
        this.listContainer.innerHTML = "<p style='text-align: center; color: #888;'>Loading agents...</p>";
        try {
            const agents = await this.api.getAgents();
            this.renderAgentList(agents);
        } catch (error) {
            console.error("Failed to load agents:", error);
            this.listContainer.innerHTML = "<p style='text-align: center; color: #e74c3c;'>Failed to load agents.</p>";
        }
    }

    renderAgentList(agents) {
        this.listContainer.innerHTML = "";

        if (agents.length === 0) {
            this.listContainer.innerHTML = "<p style='text-align: center; color: #888; padding: 20px;'>No agents yet. Create your first AI personality!</p>";
            return;
        }

        agents.forEach(agent => {
            const card = document.createElement("div");
            card.className = "agent-card";
            card.style.cssText = `
        background-color: #2d2d2d;
        border-left: 4px solid ${agent.avatar_color};
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 10px;
        cursor: pointer;
        transition: all 0.2s;
      `;

            card.onmouseover = () => card.style.backgroundColor = "#3d3d3d";
            card.onmouseout = () => card.style.backgroundColor = "#2d2d2d";

            const modelBadge = agent.model_provider === 'gemini'
                ? '<span style="background: #4285f4; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.75em; margin-left: 8px;">Gemini</span>'
                : '<span style="background: #16a085; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.75em; margin-left: 8px;">Ollama</span>';

            card.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background-color: ${agent.avatar_color}; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; margin-right: 12px;">
            ${agent.name.charAt(0).toUpperCase()}
          </div>
          <div style="flex: 1;">
            <div style="font-weight: bold; font-size: 1.1em; color: #ecf0f1;">
              ${agent.name}${modelBadge}
            </div>
            <div style="color: #95a5a6; font-size: 0.9em;">${agent.role}</div>
          </div>
        </div>
        <div style="color: #bdc3c7; font-size: 0.85em; font-style: italic; margin-top: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          "${agent.system_instructions.substring(0, 100)}${agent.system_instructions.length > 100 ? '...' : ''}"
        </div>
      `;

            card.addEventListener("click", () => this.showEditor(agent));
            this.listContainer.appendChild(card);
        });
    }

    async saveAgent() {
        const name = this.agentNameInput.value.trim();
        const role = this.agentRoleInput.value.trim();
        const instructions = this.agentInstructionsInput.value.trim();
        const model = this.agentModelSelect.value;
        const color = this.agentColorInput.value;

        if (!name || !role || !instructions) {
            alert("Please fill in all required fields.");
            return;
        }

        const payload = {
            name,
            role,
            system_instructions: instructions,
            model_provider: model,
            avatar_color: color
        };

        try {
            if (this.currentAgentId) {
                // Update existing
                await this.api.updateAgent(this.currentAgentId, payload);
            } else {
                // Create new
                await this.api.createAgent(payload);
            }

            await this.loadAgents();
            this.showList();
        } catch (error) {
            console.error("Failed to save agent:", error);
            alert(`Failed to save agent: ${error.message || error}`);
        }
    }

    async deleteAgent() {
        if (!this.currentAgentId) return;

        if (!confirm("Are you sure you want to delete this agent?")) return;

        try {
            await this.api.deleteAgent(this.currentAgentId);
            await this.loadAgents();
            this.showList();
        } catch (error) {
            console.error("Failed to delete agent:", error);
            alert(`Failed to delete agent: ${error.message || error}`);
        }
    }
}
