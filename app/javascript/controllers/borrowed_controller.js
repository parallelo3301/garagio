import { Controller } from "@hotwired/stimulus"

// Shows the "borrowed to / date" fields only while the status is "borrowed".
export default class extends Controller {
  static targets = ["status", "fields"]

  connect() {
    this.toggle()
  }

  toggle() {
    const borrowed = this.statusTarget.value === "borrowed"
    this.fieldsTarget.hidden = !borrowed
    this.fieldsTarget.querySelectorAll("input").forEach((input) => (input.disabled = !borrowed))
  }
}
