const csrfToken = () => document.querySelector("meta[name=csrf-token]")?.content

export async function uploadImages(files) {
  const data = new FormData()
  for (const file of Array.from(files)) data.append("photos[]", file)
  const response = await fetch("/uploads", {
    method: "POST",
    body: data,
    headers: { "X-CSRF-Token": csrfToken(), Accept: "application/json" },
    credentials: "same-origin"
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? "Upload failed")
  return body.paths
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
