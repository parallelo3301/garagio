import { Controller } from "@hotwired/stimulus"
import { uploadImage } from "lib/request"

// Uploads each chosen photo right away (with an instant local preview) and keeps hidden
// item[photos][] inputs in sync with the tiles. The first photo is the item's cover.
export default class extends Controller {
  static targets = ["input", "list", "template", "error"]

  connect() {
    this.pending = 0
    this.refresh()
  }

  choose(event) {
    event.currentTarget.nextElementSibling?.click()
  }

  async upload(event) {
    const files = Array.from(event.currentTarget.files)
    event.currentTarget.value = ""
    await this.addFiles(files)
  }

  // Uploads files and resolves once all are stored (used by AI recognition too).
  async addFiles(files) {
    if (!files.length) return
    this.errorTarget.hidden = true
    const tiles = files.map((file) => this.addTile(URL.createObjectURL(file), { uploading: true }))
    this.setPending(files.length)
    // Upload two at a time: fast on Wi-Fi, gentle on mobile data.
    const queue = files.map((file, index) => [file, tiles[index]])
    const worker = async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) await this.uploadOne(...entry)
    }
    await Promise.all([worker(), worker()])
  }

  async uploadOne(file, tile) {
    try {
      const path = await uploadImage(file)
      URL.revokeObjectURL(tile.querySelector("img").src)
      tile.querySelector("img").src = path
      const input = tile.querySelector("input")
      input.value = path
      input.disabled = false
      tile.removeAttribute("data-uploading")
    } catch (error) {
      tile.remove()
      this.errorTarget.textContent = `${file.name}: ${error.message}`
      this.errorTarget.hidden = false
    } finally {
      this.setPending(-1)
      this.refresh()
    }
  }

  addTile(src, { uploading = false } = {}) {
    const tile = this.templateTarget.content.firstElementChild.cloneNode(true)
    tile.querySelector("img").src = src
    const input = tile.querySelector("input")
    input.value = uploading ? "" : src
    input.disabled = uploading
    tile.toggleAttribute("data-uploading", uploading)
    this.listTarget.append(tile)
    this.refresh()
    return tile
  }

  remove(event) {
    event.currentTarget.closest("[data-photo]").remove()
    this.refresh()
  }

  makeCover(event) {
    this.listTarget.prepend(event.currentTarget.closest("[data-photo]"))
    this.refresh()
  }

  // Paths of photos that finished uploading, cover first.
  get paths() {
    return Array.from(this.listTarget.querySelectorAll("input")).filter((input) => !input.disabled && input.value).map((input) => input.value)
  }

  refresh() {
    const tiles = Array.from(this.listTarget.children)
    tiles.forEach((tile, index) => tile.toggleAttribute("data-cover", index === 0))
    this.listTarget.hidden = tiles.length === 0
  }

  setPending(change) {
    this.pending += change
    this.element.closest("form")?.querySelectorAll("[type=submit]").forEach((button) => (button.disabled = this.pending > 0))
    document.querySelectorAll(`[form="${this.element.closest("form")?.id}"][type=submit]`)
      .forEach((button) => (button.disabled = this.pending > 0))
  }
}
