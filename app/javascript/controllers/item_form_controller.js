import { Controller } from "@hotwired/stimulus"

// Shows fields for the selected item kind (tool / material) and fills amount presets.
export default class extends Controller {
  static targets = ["kind", "amount"]

  connect() {
    this.toggle()
  }

  toggle() {
    const kind = this.kindTargets.find((input) => input.checked)?.value ?? "tool"
    this.element.querySelectorAll("[data-kind-only]").forEach((section) => {
      const visible = section.dataset.kindOnly === kind
      section.hidden = !visible
      section.querySelectorAll("input, select, textarea").forEach((field) => (field.disabled = !visible))
    })
    this.element.querySelectorAll("[data-kind-label]").forEach((label) => (label.hidden = label.dataset.kindLabel !== kind))
  }

  preset(event) {
    this.amountTarget.value = event.currentTarget.dataset.value
    this.amountTarget.dispatchEvent(new Event("input", { bubbles: true }))
  }
}
