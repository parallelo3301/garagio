import { Controller } from "@hotwired/stimulus"

// Swipeable photo carousel with a full-screen lightbox. Tapping a lightbox photo toggles 1:1 (full resolution).
// Opening the lightbox adds a history entry so the phone's Back button closes it instead of leaving the page.
export default class extends Controller {
  static targets = ["track", "counter", "thumb", "dialog", "slides", "lightboxCounter", "original"]

  connect() {
    this.index = 0
    this.onPopState = this.popState.bind(this)
    window.addEventListener("popstate", this.onPopState, { capture: true })
  }

  disconnect() {
    window.removeEventListener("popstate", this.onPopState, { capture: true })
    document.documentElement.classList.remove("overflow-hidden")
  }

  get count() {
    return this.slides.length
  }

  get slides() {
    return Array.from(this.slidesTarget.children)
  }

  trackScrolled() {
    const index = Math.round(this.trackTarget.scrollLeft / this.trackTarget.clientWidth)
    if (index !== this.index) {
      this.index = index
      this.updateIndicators()
    }
  }

  select(event) {
    this.index = Number(event.currentTarget.dataset.index)
    this.trackTarget.scrollTo({ left: this.index * this.trackTarget.clientWidth, behavior: "smooth" })
    this.updateIndicators()
  }

  updateIndicators() {
    if (this.hasCounterTarget) this.counterTarget.textContent = `${this.index + 1} / ${this.count}`
    this.thumbTargets.forEach((thumb, index) => thumb.setAttribute("aria-current", index === this.index))
  }

  open(event) {
    this.index = Number(event.currentTarget.dataset.index)
    this.dialogTarget.showModal()
    document.documentElement.classList.add("overflow-hidden")
    this.slidesTarget.scrollLeft = this.index * this.slidesTarget.clientWidth
    this.slidesTarget.addEventListener("scroll", this.onSlidesScroll ??= this.slidesScrolled.bind(this), { passive: true })
    this.updateLightbox()
    history.pushState({ garagioLightbox: true }, "")
    this.pushedState = true
  }

  close() {
    this.dialogTarget.close()
  }

  // Fired by the dialog for the close button, Escape and history navigation.
  closed() {
    document.documentElement.classList.remove("overflow-hidden")
    this.slides.forEach((slide) => slide.classList.remove("zoomed"))
    if (this.pushedState) {
      this.pushedState = false
      this.ignoreNextPop = true
      history.back()
    }
    this.trackTarget.scrollLeft = this.index * this.trackTarget.clientWidth
    this.updateIndicators()
  }

  // Runs before Turbo's popstate listener, so Turbo doesn't treat the lightbox entry as a page visit.
  popState(event) {
    if (this.ignoreNextPop) {
      this.ignoreNextPop = false
      event.stopImmediatePropagation()
    } else if (this.dialogTarget.open) {
      event.stopImmediatePropagation()
      this.pushedState = false
      this.dialogTarget.close()
    }
  }

  slidesScrolled() {
    const index = Math.round(this.slidesTarget.scrollLeft / this.slidesTarget.clientWidth)
    if (index !== this.index) {
      this.slides[this.index]?.classList.remove("zoomed")
      this.index = index
      this.updateLightbox()
    }
  }

  updateLightbox() {
    const image = this.slides[this.index]?.querySelector("img")
    this.lightboxCounterTarget.textContent = this.count > 1 ? `${this.index + 1} / ${this.count}` : ""
    if (image) this.originalTarget.href = image.getAttribute("src")
  }

  previous() {
    this.scrollLightbox(Math.max(this.index - 1, 0))
  }

  next() {
    this.scrollLightbox(Math.min(this.index + 1, this.count - 1))
  }

  scrollLightbox(index) {
    this.slidesTarget.scrollTo({ left: index * this.slidesTarget.clientWidth, behavior: "smooth" })
  }

  key(event) {
    if (event.key === "ArrowLeft") this.previous()
    if (event.key === "ArrowRight") this.next()
  }

  toggleZoom(event) {
    const slide = event.currentTarget
    const rect = slide.getBoundingClientRect()
    const ratioX = (event.clientX - rect.left) / rect.width
    const ratioY = (event.clientY - rect.top) / rect.height
    slide.classList.toggle("zoomed")
    if (slide.classList.contains("zoomed")) {
      slide.scrollLeft = ratioX * slide.scrollWidth - slide.clientWidth / 2
      slide.scrollTop = ratioY * slide.scrollHeight - slide.clientHeight / 2
    }
  }
}
