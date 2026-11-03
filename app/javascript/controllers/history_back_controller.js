import { Controller } from "@hotwired/stimulus"

// Goes back in history when the previous entry is part of this app session (restoring search and scroll);
// otherwise follows the link's href.
export default class extends Controller {
  go(event) {
    if ((history.state?.turbo?.restorationIndex ?? 0) > 0) {
      event.preventDefault()
      history.back()
    }
  }
}
