import { Controller } from "@hotwired/stimulus"
import { postJSON } from "lib/request"

// Sends the item's photos to the configured AI model and fills the form with its suggestions.
export default class extends Controller {
  static targets = ["status", "result", "buttons", "webSearch"]
  static outlets = ["photos"]
  static values = { url: String }

  choose(event) {
    event.currentTarget.nextElementSibling?.click()
  }

  async snap(event) {
    const files = Array.from(event.currentTarget.files)
    event.currentTarget.value = ""
    if (!files.length) return
    this.busy("Uploading photo…")
    await this.photosOutlet.addFiles(files)
    await this.identify()
  }

  async identify() {
    const photos = this.photosOutlet.paths
    if (!photos.length) return this.fail("Add a photo of the item first.")
    this.busy(`Identifying from ${photos.length} photo${photos.length > 1 ? "s" : ""}… this can take up to a minute.`)
    try {
      const payload = { photos }
      if (this.hasWebSearchTarget) payload.web_search = this.webSearchTarget.checked
      const result = await postJSON(this.urlValue, payload)
      this.fill(result)
      this.show(result)
    } catch (error) {
      this.fail(error.message)
    } finally {
      this.buttonsTarget.querySelectorAll("button").forEach((button) => (button.disabled = false))
    }
  }

  fill(result) {
    const form = this.element.closest("form")
    const name = form.elements["item[name]"]
    const description = form.elements["item[description]"]
    const replace = [[name, result.name], [description, result.description]]
      .filter(([field, value]) => value && field.value.trim() && field.value.trim() !== value.trim())
    const overwrite = !replace.length ||
      confirm(`Replace the current ${replace.map(([field]) => field === name ? "name" : "description").join(" and ")} with the AI suggestion?`)
    for (const [field, value] of [[name, result.name], [description, result.description]]) {
      if (!value || (field.value.trim() && !overwrite)) continue
      field.value = value
      field.dispatchEvent(new Event("input", { bubbles: true }))
    }

    const kind = form.querySelector(`input[name="item[kind]"][value="${result.kind}"]`)
    if (kind && !kind.checked) {
      kind.checked = true
      kind.dispatchEvent(new Event("input", { bubbles: true }))
    }
    const amount = form.elements["item[amount]"]
    if (result.kind === "material" && result.amount && amount && !amount.value.trim()) amount.value = result.amount

    if (result.tags?.length) this.chips("item[tag_list]")?.addValues(result.tags)
    if (result.manufacturer) this.setManufacturer(form, result.manufacturer)
  }

  setManufacturer(form, { id, name }) {
    const select = form.elements["item[manufacturer_id]"]
    // Keep a manufacturer the user already picked.
    if (!select || (select.value && select.value !== "__new__")) return
    form.querySelector("[data-ai-new-manufacturer]")?.remove()
    if (id) {
      select.value = String(id)
      select.querySelector('option[value="__new__"]')?.remove()
      return
    }
    let option = select.querySelector('option[value="__new__"]')
    if (!option) {
      option = new Option("", "__new__")
      select.append(option)
    }
    option.textContent = `${name} (new)`
    select.value = "__new__"
    const hidden = Object.assign(document.createElement("input"), { type: "hidden", name: "item[manufacturer_name]", value: name })
    hidden.dataset.aiNewManufacturer = ""
    select.after(hidden)
  }

  chips(name) {
    const element = this.element.closest("form").querySelector(`input[name="${name}"]`)?.closest("[data-controller~=chips]")
    return element && this.application.getControllerForElementAndIdentifier(element, "chips")
  }

  show(result) {
    this.statusTarget.hidden = true
    const badge = { high: "badge-success", medium: "badge-warning", low: "badge-error" }[result.confidence] ?? "badge-ghost"
    const parts = [`<div class="flex flex-wrap items-center gap-2"><span class="badge badge-sm ${badge}">${this.escape(result.confidence)} confidence</span>`]
    if (result.model_number) parts.push(`<span class="text-sm text-base-content/70">Model: <strong>${this.escape(result.model_number)}</strong></span>`)
    parts.push("</div>")
    if (result.notes) parts.push(`<p class="mt-2 text-sm text-base-content/70">${this.escape(result.notes)}</p>`)
    if (result.sources?.length) {
      const links = result.sources.map((source) =>
        `<li class="truncate"><a class="link link-primary" href="${this.escape(source.url)}" target="_blank" rel="noopener noreferrer">${this.escape(this.sourceLabel(source))}</a></li>`)
      parts.push(`<ul class="mt-2 space-y-1 text-sm">${links.join("")}</ul>`)
    }
    parts.push(`<p class="mt-2 text-xs text-base-content/50">Filled in by ${this.escape(result.model)}. Check the details before saving.</p>`)
    this.resultTarget.innerHTML = parts.join("")
    this.resultTarget.hidden = false
  }

  // Some providers use the URL as the title; show "host: path" instead of the raw link.
  sourceLabel({ title, url }) {
    if (title && title !== url) return title
    try {
      const { hostname, pathname } = new URL(url)
      const path = decodeURIComponent(pathname).replace(/\/$/, "")
      return path ? `${hostname.replace(/^www\./, "")}: ${path}` : hostname
    } catch {
      return url
    }
  }

  busy(message) {
    this.buttonsTarget.querySelectorAll("button").forEach((button) => (button.disabled = true))
    this.resultTarget.hidden = true
    this.statusTarget.className = "mt-3 flex items-center gap-2 text-sm text-base-content/70"
    this.statusTarget.innerHTML = `<span class="loading loading-spinner loading-sm"></span><span>${this.escape(message)}</span>`
    this.statusTarget.hidden = false
  }

  fail(message) {
    this.buttonsTarget.querySelectorAll("button").forEach((button) => (button.disabled = false))
    this.statusTarget.className = "mt-3 text-sm text-error"
    this.statusTarget.textContent = message
    this.statusTarget.hidden = false
  }

  escape(value) {
    const span = document.createElement("span")
    span.textContent = value ?? ""
    return span.innerHTML
  }
}
