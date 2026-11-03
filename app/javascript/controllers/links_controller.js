import { Controller } from "@hotwired/stimulus"

// Adds/removes label + URL rows that submit as item[links][][label|url].
export default class extends Controller {
  static targets = ["label", "url", "list", "template", "error"]

  add(event) {
    event.preventDefault()
    const label = this.labelTarget.value.trim()
    let url = this.urlTarget.value.trim()
    if (!url) return this.urlTarget.focus()
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    const node = this.templateTarget.content.firstElementChild.cloneNode(true)
    const anchor = node.querySelector("a")
    anchor.href = url
    anchor.textContent = label || url
    node.querySelector("[data-field=label]").value = label || url
    node.querySelector("[data-field=url]").value = url
    this.listTarget.append(node)
    this.listTarget.hidden = false
    this.labelTarget.value = ""
    this.urlTarget.value = ""
    this.labelTarget.focus()
  }

  addOnEnter(event) {
    if (event.key === "Enter") this.add(event)
  }

  remove(event) {
    event.currentTarget.closest("li").remove()
    this.listTarget.hidden = this.listTarget.children.length === 0
  }
}
