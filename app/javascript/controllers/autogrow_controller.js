import { Controller } from "@hotwired/stimulus"

// Grows a textarea with its content so long descriptions are fully visible while editing.
export default class extends Controller {
  connect() {
    this.resize()
  }

  resize() {
    const minHeight = parseFloat(getComputedStyle(this.element).minHeight) || 0
    this.element.style.height = "auto"
    this.element.style.height = `${Math.max(this.element.scrollHeight + 2, minHeight)}px`
  }
}
