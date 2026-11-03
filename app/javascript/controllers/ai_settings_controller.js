import { Controller } from "@hotwired/stimulus"
import { getJSON } from "lib/request"

// AI settings: presets fill the API URL and default model; models can be listed from the provider.
export default class extends Controller {
  static targets = ["provider", "baseUrl", "model", "modelList", "modelHint", "loadButton", "webSearch", "webSearchHint"]
  static values = { presets: Object, modelsUrl: String }

  connect() {
    this.updateWebSearch()
  }

  changeProvider() {
    const preset = this.presetsValue[this.providerTarget.value]
    if (!preset) return
    this.baseUrlTarget.value = preset.base_url
    this.modelTarget.value = preset.model
    this.modelListTarget.replaceChildren()
    this.updateWebSearch()
  }

  updateWebSearch() {
    const supported = this.presetsValue[this.providerTarget.value]?.web_search === true
    this.webSearchTarget.disabled = !supported
    this.webSearchHintTarget.classList.toggle("opacity-50", !supported)
    this.webSearchHintTarget.textContent = supported
      ? this.webSearchHintTarget.dataset.supported
      : "Not available for this provider (works with Vercel, OpenRouter and xAI)"
    if (!supported) this.webSearchTarget.checked = false
  }

  async loadModels() {
    this.loadButtonTarget.disabled = true
    const params = new URLSearchParams({ provider: this.providerTarget.value, base_url: this.baseUrlTarget.value })
    try {
      const { models } = await getJSON(`${this.modelsUrlValue}?${params}`)
      this.modelListTarget.replaceChildren(...models.map((id) => new Option(id, id)))
      this.modelHintTarget.textContent = `${models.length} models available. Start typing in the model field to pick one.`
      this.modelTarget.focus()
    } catch (error) {
      this.modelHintTarget.textContent = `${error.message} (save the token first)`
    } finally {
      this.loadButtonTarget.disabled = false
    }
  }
}
