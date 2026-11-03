import { Controller } from "@hotwired/stimulus"
import { uploadImages } from "lib/request"

// Uploads photos immediately and keeps hidden item[photos][] inputs in sync with the thumbnails.
export default class extends Controller {
  static targets = ["input", "list", "template", "status", "error"]

  async upload() {
    const files = this.inputTarget.files
    if (!files.length) return
    this.busy(true)
    try {
      const paths = await uploadImages(files)
      paths.forEach((path) => this.add(path))
    } catch (error) {
      this.errorTarget.textContent = error.message
      this.errorTarget.hidden = false
    } finally {
      this.inputTarget.value = ""
      this.busy(false)
    }
  }

  add(path) {
    const node = this.templateTarget.content.firstElementChild.cloneNode(true)
    node.querySelector("img").src = path
    node.querySelector("input").value = path
    this.listTarget.append(node)
  }

  remove(event) {
    event.currentTarget.closest("[data-photo]").remove()
  }

  busy(state) {
    this.statusTarget.hidden = !state
    this.errorTarget.hidden = true
    this.element.closest("form")?.querySelectorAll("[type=submit]").forEach((button) => (button.disabled = state))
  }
}
