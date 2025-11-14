// frontend/js/components/SettingsModal.js

class SettingsModal {
  constructor(apiService) {
    console.log("SettingsModal: Initializing...");
    this.api = apiService;
    this.isOpen = false;
    this.currentSettings = {};
    this.availableModels = [];

    this.modal = document.getElementById("settings-modal");
    this.closeButton = document.getElementById("settings-close-button");
    this.saveButton = document.getElementById("settings-save-button");
    this.providerSelect = document.getElementById("ai-provider-select");
    this.geminiSettings = document.getElementById("gemini-settings");
    this.runpodSettings = document.getElementById("runpod-settings");
    this.geminiApiKeyInput = document.getElementById("gemini-api-key");
    this.runpodUrlInput = document.getElementById("runpod-url");
    this.ollamaModelSelect = document.getElementById("ollama-model-select");
    this.refreshModelsButton = document.getElementById("refresh-models-button");

    this.onSettingsChangedCallback = null;

    this._addEventListeners();
    console.log("SettingsModal: Initialized.");
  }

  _addEventListeners() {
    this.closeButton.addEventListener("click", () => this.close());
    this.saveButton.addEventListener("click", () => this.save());
    this.providerSelect.addEventListener("change", () =>
      this._toggleProviderSettings()
    );
    this.refreshModelsButton.addEventListener("click", () =>
      this.refreshOllamaModels(this.ollamaModelSelect.value, true)
    );
  }

  async open() {
    console.log("SettingsModal: Opening...");
    this.modal.style.display = "flex";
    this.isOpen = true;

    try {
      const settings = await this.api.getSettings();
      this.currentSettings = settings;

      this.providerSelect.value = settings.ai_provider || "gemini";
      this.geminiApiKeyInput.value = settings.gemini_api_key || "";
      this.runpodUrlInput.value = settings.runpod_url || "";

      this._toggleProviderSettings();

      // This will populate the dropdown with models if a URL is already saved
      await this.refreshOllamaModels(settings.ollama_model_name, false);
    } catch (error) {
      console.error("SettingsModal: Failed to open and load.", error);
    }
  }

  close() {
    this.modal.style.display = "none";
    this.isOpen = false;
  }

  async save() {
    const settingsToSave = {
      ai_provider: this.providerSelect.value,
      gemini_api_key: this.geminiApiKeyInput.value.trim(),
      runpod_url: this.runpodUrlInput.value.trim(),
      ollama_model_name: this.ollamaModelSelect.value,
    };
    try {
      await this.api.saveSettings(settingsToSave);
      this.currentSettings = settingsToSave;
      alert("Settings saved successfully!");
      this.close();
      if (this.onSettingsChangedCallback) {
        this.onSettingsChangedCallback();
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Could not save settings.");
    }
  }

  async refreshOllamaModels(selectedValue = null, showAlerts = true) {
    const runpodUrl = this.runpodUrlInput.value.trim();
    if (this.providerSelect.value !== "runpod" || !runpodUrl) {
      this.ollamaModelSelect.innerHTML =
        '<option value="">-- Enter a URL first --</option>';
      return;
    }

    this.ollamaModelSelect.innerHTML =
      '<option value="">-- Loading models... --</option>';
    this.refreshModelsButton.disabled = true;

    try {
      // First, save the current URL to the backend so it knows where to check
      await this.api.saveSettings({ runpod_url: runpodUrl });

      // Now, ask the backend to fetch models from that URL
      const data = await this.api.getOllamaModels();

      this.ollamaModelSelect.innerHTML = "";
      const newOllamaModels = data.models || [];

      if (newOllamaModels.length > 0) {
        newOllamaModels.forEach((modelName) => {
          this.ollamaModelSelect.add(new Option(modelName, modelName));
        });
        // Try to re-select the previously saved value, otherwise default to the first in the list
        if (selectedValue && newOllamaModels.includes(selectedValue)) {
          this.ollamaModelSelect.value = selectedValue;
        } else {
          this.ollamaModelSelect.value = newOllamaModels[0];
        }
      } else {
        this.ollamaModelSelect.innerHTML =
          '<option value="">-- No models found --</option>';
      }
    } catch (error) {
      console.error("Failed to refresh Ollama models:", error);
      this.ollamaModelSelect.innerHTML = `<option value="">-- Error: ${error.message} --</option>`;
      if (showAlerts) {
        alert(`Could not fetch models from the endpoint: ${error.message}`);
      }
    } finally {
      this.refreshModelsButton.disabled = false;
    }
  }

  _toggleProviderSettings() {
    const provider = this.providerSelect.value;
    this.geminiSettings.style.display =
      provider === "gemini" ? "block" : "none";
    this.runpodSettings.style.display =
      provider === "runpod" ? "block" : "none";
  }
}
