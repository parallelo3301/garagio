import { Controller } from "@hotwired/stimulus"
import { postForm, uploadImages } from "lib/request"

// Markdown editor with server-rendered live preview and image upload via drop, paste or file picker.
export default class extends Controller {
  static targets = ["content", "preview", "file", "status"]
  static values = { previewUrl: String }

  connect() {
    this.render()
  }

  disconnect() {
    clearTimeout(this.timeout)
  }

  queueRender() {
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => this.render(), 250)
  }

  async render() {
    const content = this.contentTarget.value
    if (!content.trim()) {
      this.previewTarget.innerHTML = '<p class="text-base-content/40">Nothing to preview yet.</p>'
      return
    }
    try {
      this.previewTarget.innerHTML = await postForm(this.previewUrlValue, { content })
    } catch {
      // Keep the previous preview when offline.
    }
  }

  dragOver(event) {
    event.preventDefault()
  }

  drop(event) {
    const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/"))
    if (!files.length) return
    event.preventDefault()
    this.upload(files)
  }

  paste(event) {
    const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"))
    if (!files.length) return
    event.preventDefault()
    this.upload(files)
  }

  pick() {
    this.upload(this.fileTarget.files)
    this.fileTarget.value = ""
  }

  async upload(files) {
    if (!files.length) return
    this.statusTarget.hidden = false
    try {
      const paths = await uploadImages(files)
      const value = this.contentTarget.value
      const images = paths.map((path) => `![](${path})`).join("\n\n")
      this.contentTarget.value = `${value.trimEnd()}${value.trim() ? "\n\n" : ""}${images}\n\n`
      this.render()
    } catch (error) {
      alert(error.message)
    } finally {
      this.statusTarget.hidden = true
    }
  }
}
