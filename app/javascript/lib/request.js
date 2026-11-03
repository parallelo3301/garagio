import { prepareImage } from "lib/image"

const csrfToken = () => document.querySelector("meta[name=csrf-token]")?.content

// Uploads one request per image so large selections stay under proxy body limits.
export async function uploadImages(files) {
  const paths = []
  for (const file of Array.from(files)) paths.push(await uploadImage(file))
  return paths
}

export async function uploadImage(file) {
  const data = new FormData()
  data.append("photos[]", await prepareImage(file))
  const response = await fetch("/uploads", {
    method: "POST",
    body: data,
    headers: { "X-CSRF-Token": csrfToken(), Accept: "application/json" },
    credentials: "same-origin"
  })
  const body = await response.json().catch(() => ({}))
  if (response.status === 413) throw new Error("Photo is too large for the server (check the reverse proxy upload limit)")
  if (!response.ok) throw new Error(body.error ?? `Upload failed (${response.status})`)
  return body.paths[0]
}

export async function postForm(url, params) {
  const response = await fetch(url, {
    method: "POST",
    body: new URLSearchParams(params),
    headers: { "X-CSRF-Token": csrfToken(), Accept: "text/html" },
    credentials: "same-origin"
  })
  if (!response.ok) throw new Error("Request failed")
  return response.text()
}

export async function postJSON(url, params) {
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(params),
    headers: { "X-CSRF-Token": csrfToken(), "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin"
  })
  const body = await response.json().catch(() => ({}))
  if (response.status === 504) throw new Error("The server gave up waiting for the AI service. Try again, or disable web search.")
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`)
  return body
}

export async function getJSON(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`)
  return body
}
