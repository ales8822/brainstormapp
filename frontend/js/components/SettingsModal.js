// frontend/js/components/SettingsModal.js

// This class will manage everything related to the settings popup: opening it, closing it, fetching and saving settings, and refreshing the Ollama model list.

class SettingsModal {
  constructor(apiService) {
    console.log("SettingsModal: Initializing...");
    this.api = apiService;
    this.isOpen = false;

    // DOM Element References
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

    // This will be set by the App class later
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
      this.refreshOllamaModels()
    );
  }

  async open() {
    console.log("SettingsModal: Opening...");
    try {
      const settings = await this.api.getSettings();
      this.providerSelect.value = settings.ai_provider || "gemini";
      this.geminiApiKeyInput.value = settings.gemini_api_key || "";
      this.runpodUrlInput.value = settings.runpod_url || "";

      await this.refreshOllamaModels(settings.ollama_model_name);

      this._toggleProviderSettings();
      this.modal.style.display = "flex";
      this.isOpen = true;
    } catch (error) {
      console.error("SettingsModal: Failed to load settings.", error);
      alert("Could not load settings from the server.");
    }
  }

  close() {
    console.log("SettingsModal: Closing...");
    this.modal.style.display = "none";
    this.isOpen = false;
  }

  async save() {
    console.log("SettingsModal: Saving settings...");
    const settingsToSave = {
      ai_provider: this.providerSelect.value,
      gemini_api_key: this.geminiApiKeyInput.value.trim(),
      runpod_url: this.runpodUrlInput.value.trim(),
      ollama_model_name: this.ollamaModelSelect.value,
    };
    try {
      await this.api.saveSettings(settingsToSave);
      alert("Settings saved successfully!");
      this.close();
      // Notify the main app that settings have changed
      if (this.onSettingsChangedCallback) {
        this.onSettingsChangedCallback();
      }
    } catch (error) {
      console.error("SettingsModal: Failed to save settings.", error);
      alert("Could not save settings.");
    }
  }

  async refreshOllamaModels(selectedValue = null) {
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
      // Temporarily save the URL so the backend can use it to fetch models
      await this.api.saveSettings({ runpod_url: runpodUrl });
      const data = await this.api.getOllamaModels();

      this.ollamaModelSelect.innerHTML = "";
      if (data.models && data.models.length > 0) {
        data.models.forEach((modelName) => {
          const option = new Option(modelName, modelName);
          this.ollamaModelSelect.add(option);
        });
        this.ollamaModelSelect.value = selectedValue || data.models[0];
      } else {
        this.ollamaModelSelect.innerHTML =
          '<option value="">-- No models found --</option>';
      }
    } catch (error) {
      console.error("SettingsModal: Failed to refresh Ollama models.", error);
      this.ollamaModelSelect.innerHTML = `<option value="">-- Error: ${error.message} --</option>`;
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
