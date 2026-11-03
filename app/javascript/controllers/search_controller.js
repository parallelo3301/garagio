import { Controller } from "@hotwired/stimulus"

// Submits the surrounding GET form shortly after typing stops.
export default class extends Controller {
  static values = { delay: { type: Number, default: 200 } }

  submit() {
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => this.element.requestSubmit(), this.delayValue)
  }

  disconnect() {
    clearTimeout(this.timeout)
  }
}
