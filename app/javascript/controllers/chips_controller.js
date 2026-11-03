import { Controller } from "@hotwired/stimulus"

// Pill input backed by a hidden field. Suggests existing values and accepts new ones.
// multiple: comma separated list (tags); otherwise a single value (location).
export default class extends Controller {
  static targets = ["value", "list", "input", "menu"]
  static values = { suggestions: Array, multiple: Boolean, noun: { type: String, default: "value" } }

  connect() {
    this.selected = this.multipleValue
      ? this.valueTarget.value.split(",").map((value) => value.trim()).filter(Boolean)
      : [this.valueTarget.value.trim()].filter(Boolean)
    this.active = -1
    this.form = this.element.closest("form")
    this.form?.addEventListener("submit", (this.onSubmit = () => this.commit()))
    this.render()
  }

  disconnect() {
    this.form?.removeEventListener("submit", this.onSubmit)
  }

  focus(event) {
    if (event.target === event.currentTarget) this.inputTarget.focus()
  }

  filter() {
    const text = this.inputTarget.value.trim()
    const query = text.toLowerCase()
    const taken = new Set(this.selected.map((value) => value.toLowerCase()))
    this.options = this.suggestionsValue
      .filter((value) => !taken.has(value.toLowerCase()) && value.toLowerCase().includes(query))
      .slice(0, 8)
      .map((value) => ({ value, label: value }))
    const exists = this.suggestionsValue.some((value) => value.toLowerCase() === query) || taken.has(query)
    if (text && !exists) this.options.push({ value: text, label: `Add “${text}”`, create: true })
    this.active = text && this.options.length ? 0 : -1
    this.renderMenu()
  }

  key(event) {
    const open = !this.menuTarget.hidden && this.options?.length
    if (event.key === "ArrowDown" && open) {
      event.preventDefault()
      this.active = (this.active + 1) % this.options.length
      this.renderMenu()
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault()
      this.active = (this.active - 1 + this.options.length) % this.options.length
      this.renderMenu()
    } else if (event.key === "Enter" || (event.key === "," && this.multipleValue)) {
      if (!this.inputTarget.value.trim() && this.active < 0) return
      event.preventDefault()
      this.add(open && this.active >= 0 ? this.options[this.active].value : this.inputTarget.value)
    } else if (event.key === "Backspace" && !this.inputTarget.value && this.selected.length) {
      this.remove({ params: { index: this.selected.length - 1 } })
    } else if (event.key === "Escape" && open) {
      event.stopPropagation()
      this.hideMenu()
    }
  }

  // Keeps focus in the input while a suggestion is clicked.
  keepFocus(event) {
    event.preventDefault()
  }

  pick(event) {
    this.add(this.options[Number(event.currentTarget.dataset.index)].value)
  }

  blur() {
    this.commit()
    this.hideMenu()
  }

  commit() {
    if (this.inputTarget.value.trim()) this.add(this.inputTarget.value, { refocus: false })
  }

  add(value, { refocus = true } = {}) {
    value = value.replaceAll(",", " ").trim()
    if (value && !this.selected.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      const known = this.suggestionsValue.find((existing) => existing.toLowerCase() === value.toLowerCase())
      this.selected = this.multipleValue ? [...this.selected, known ?? value] : [known ?? value]
    }
    this.inputTarget.value = ""
    this.render()
    if (refocus && this.multipleValue) {
      this.inputTarget.focus()
      this.filter()
    } else {
      this.hideMenu()
    }
  }

  // Adds values programmatically (AI suggestions), keeping existing ones.
  addValues(values) {
    values.forEach((value) => this.add(value, { refocus: false }))
  }

  remove({ params: { index } }) {
    this.selected = this.selected.filter((_, position) => position !== index)
    this.render()
    this.inputTarget.focus()
  }

  render() {
    this.valueTarget.value = this.selected.join(", ")
    this.listTarget.replaceChildren(...this.selected.map((value, index) => this.chip(value, index)))
    this.inputTarget.hidden = !this.multipleValue && this.selected.length > 0
    this.inputTarget.placeholder = this.selected.length ? "" : this.inputTarget.dataset.placeholder
  }

  chip(value, index) {
    const chip = document.createElement("span")
    chip.className = "badge badge-primary badge-soft h-auto min-h-7 gap-1 py-1 pl-2.5 pr-1 text-sm"
    chip.textContent = value
    const button = document.createElement("button")
    button.type = "button"
    button.className = "btn btn-ghost btn-circle btn-xs size-5 min-h-0"
    button.setAttribute("aria-label", `Remove ${this.nounValue} ${value}`)
    button.dataset.action = "chips#remove"
    button.dataset.chipsIndexParam = index
    button.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'
    chip.append(button)
    return chip
  }

  renderMenu() {
    if (!this.options?.length) return this.hideMenu()
    this.menuTarget.replaceChildren(...this.options.map((option, index) => {
      const item = document.createElement("li")
      const button = document.createElement("button")
      button.type = "button"
      button.className = `w-full ${index === this.active ? "menu-active" : ""} ${option.create ? "text-primary" : ""}`
      button.textContent = option.label
      button.dataset.index = index
      button.dataset.action = "mousedown->chips#keepFocus click->chips#pick"
      item.append(button)
      return item
    }))
    this.menuTarget.hidden = false
  }

  hideMenu() {
    this.menuTarget.hidden = true
    this.active = -1
  }
}
