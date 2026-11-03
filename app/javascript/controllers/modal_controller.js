import { Controller } from "@hotwired/stimulus"

// Item sheet shown inside the "modal" turbo frame. Escape or backdrop click closes it.
export default class extends Controller {
  connect() {
    document.documentElement.classList.add("overflow-hidden")
    this.element.querySelector("[autofocus]")?.focus()
  }

  disconnect() {
    document.documentElement.classList.remove("overflow-hidden")
  }

  close(event) {
    event?.preventDefault()
    const frame = this.element.closest("turbo-frame")
    frame.removeAttribute("src")
    frame.innerHTML = ""
    const url = new URL(window.location.href)
    if (url.searchParams.has("item")) {
      url.searchParams.delete("item")
      history.replaceState(history.state, "", url)
    }
  }

  closeOnEscape(event) {
    if (event.key === "Escape") this.close(event)
  }
}
