import { Controller } from "@hotwired/stimulus"

// Auto-dismisses toast notifications.
export default class extends Controller {
  connect() {
    this.timeout = setTimeout(() => this.dismiss(), 3500)
  }

  disconnect() {
    clearTimeout(this.timeout)
  }

  dismiss() {
    this.element.remove()
  }
}
