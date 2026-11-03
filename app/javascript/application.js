// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import { Turbo } from "@hotwired/turbo-rails"
import "controllers"

// <turbo-stream action="redirect" target="/path"> closes any modal frame and visits the URL.
Turbo.StreamActions.redirect = function () {
  Turbo.visit(this.target, { action: "replace" })
}
