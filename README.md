# Garagio

Garagio is a lightweight, self-hosted inventory manager for workshop and garage tools, built with Ruby on Rails 8.1, Hotwire (Turbo + Stimulus), Tailwind CSS 4 with daisyUI 5, and SQLite.

It is designed for a phone in the workshop, while remaining comfortable on a desktop or tablet.

## Features

- Inventory split into **Tools** (one row per physical tool) and **Materials** (consumables with a rough amount like `100+` or `running low`).
- Each item has a read-only page at `/items/:id` showing the formatted description, details and a photo gallery, plus a separate full-page editor. Items can be duplicated.
- Location and tags use pill inputs that suggest values already in use.
- Multiple photos per item. Choose the cover photo; view photos full-screen and at full resolution. Large photos are downscaled in the browser (max 2560 px) before upload.
- Mobile-first UI built with Turbo and Stimulus: no accidental zoom, and Back/Forward history works.
- Optional **AI fill**: photograph an item (or its type plate/packaging) and a vision model suggests the name, manufacturer, description, tags and amount, optionally confirmed by web search. See [AI recognition](#ai-recognition).
- Wiki pages with search, live Markdown preview (GitHub-flavoured, auto-linking), image upload/drop/paste, editing, and deletion.
- Bidirectional item/Wiki relationships.
- Password-protected application and JSON API access.
- SQLite-backed sessions that survive restarts, with a 30-day expiry and login IP address storage.
- Automatic IP ban for five failed password attempts; bans expire after one month.
- Portable data: one directory holds the database, uploads and generated secret.

## Requirements

- [mise](https://mise.jdx.dev/) to install the Ruby version pinned in `mise.toml` (Ruby 4.0.9), or any other way to get that Ruby.
- SQLite 3.

## Quick start (development)

```bash
mise install
cp .env.example .env      # set ACCESS_PASSWORD
bin/setup --skip-server   # installs gems and prepares the database
bin/dev
```

Open http://localhost:4000 and sign in with the password from `.env`. `bin/dev` runs Rails and the Tailwind watcher. It always listens on port 4000 (override with `DEV_PORT`), independent of `PORT` in `.env`.

In development the data lives in `storage/` (`storage/db.sqlite`, `storage/uploads/`).

## Configuration

Configuration comes from environment variables. In development and on bare-metal hosts they can also come from `.env`, which is ignored by Git; use `.env.example` as the template.

| Variable | Description |
| --- | --- |
| `ACCESS_PASSWORD` | Required password for application access. Change it before deployment. |
| `PORT` | HTTP port for production/Docker. Defaults to `8000`. |
| `TRUST_PROXY` | Set to `true` only behind a trusted reverse proxy. Login IP tracking and bans then use the first `X-Forwarded-For` value, falling back to `X-Real-IP`. |
| `FORCE_SSL` | Set to `true` when served over HTTPS (redirects to HTTPS, secure cookies, HSTS). |
| `SECRET_KEY_BASE` | Optional. If unset, a secret is generated once and stored as `secret_key_base` in the data directory. |
| `GARAGIO_DATA_DIR` | Directory for `db.sqlite`, `uploads/` and the generated secret. Defaults to `storage/`; `/data` in Docker. |

Do not enable `TRUST_PROXY=true` when the service is directly reachable from untrusted clients: anyone can forge forwarded IP headers unless a reverse proxy strips them.

## AI recognition

Configure it in **Settings → AI recognition**. Any OpenAI-compatible API works; presets fill in the URL and a default vision model:

| Provider | Web search |
| --- | --- |
| Vercel AI Gateway | yes (Perplexity search tool) |
| OpenRouter | yes (`web` plugin) |
| xAI (Grok) | yes (Responses API `web_search` tool) |
| OpenAI, Google Gemini | no |
| Custom (e.g. Ollama) | no; the token is optional |

- **Load models** lists the provider's vision models. The answer language is configurable.
- The API token is stored encrypted in the database with a key derived from the app secret (`SECRET_KEY_BASE` or `data/secret_key_base`). If that secret changes, enter the token again.
- Photos are sent to the selected provider. Web search is chosen per scan with the **Search the web** checkbox (off by default; Settings can pre-check it). Reading the type plate usually identifies the model; search adds specs and sources but costs about 3× more (with Grok roughly $0.016 vs $0.05 per scan).
- A scan usually takes 15–40 s. If a reverse proxy sits in front of Garagio, allow at least 90 s of read timeout and request bodies of several MB for photo uploads.

## Development commands

```bash
bin/dev                    # Rails on :4000 + Tailwind watcher
bin/rails test             # test suite
bin/rubocop                # lint
bin/brakeman               # security scan
bin/rails tailwindcss:build
bin/rails generate migration AddSomething
```

Styles live in `app/assets/tailwind/application.css` (Tailwind 4 + vendored daisyUI in the same folder). The built CSS in `app/assets/builds/` is generated and not committed. Interactivity is in Stimulus controllers under `app/javascript/controllers/`.

## Docker deployment

GitHub Actions (`.github/workflows/docker.yml`) runs lint, security scan and tests. On every push to `master` (and on `v*` tags) it publishes a `linux/amd64` image to `ghcr.io/parallelo3301/garagio`.

```bash
cp .env.example .env       # set ACCESS_PASSWORD
docker compose up -d       # uses ghcr.io/parallelo3301/garagio:latest
```

Or without compose:

```bash
docker run -d -p 8000:8000 -e ACCESS_PASSWORD=change-me -v ./data:/data ghcr.io/parallelo3301/garagio:latest
```

Open http://localhost:8000. The `data/` directory holds `db.sqlite`, `uploads/` and `secret_key_base`; back it up as one unit.

- **Upgrade:** `docker compose pull && docker compose up -d`. Migrations run automatically on start.
- **Build locally:** uncomment `build: .` in `compose.yml`, or run `docker build -t garagio .`.

The container runs as uid 1000; the entrypoint fixes ownership of `/data` on start. A `/up` health check is built in.

For reverse-proxy deployments, point the proxy to port 8000, have it set `X-Forwarded-For`, and set `TRUST_PROXY=true`. If it terminates TLS, also set `FORCE_SSL=true`. Allow request bodies of at least a few MB (nginx: `client_max_body_size 25m;`) so photo and wiki uploads aren't rejected with 413.

## Upgrading from the Deno version

The Rails version uses the same data layout (`db.sqlite` + `uploads/`) and the same `compose.yml` volume (`./data:/data`). On first start, `db:prepare` detects a database created by the Deno version and migrates it in place. Items, tags, manufacturers, wiki pages, links, sessions and login bans are kept, and existing sessions stay valid. Back up `data/` before upgrading.

The JSON API keeps the original paths and payloads (`/api/auth/login`, `/api/items`, `/api/manufacturers`, `/api/wiki`, `/api/uploads`).

## Data and backups

All mutable application data lives in the data directory (`storage/` in development, `/data` in Docker):

```text
db.sqlite (+ -wal/-shm while running)
uploads/
secret_key_base
```

To back up, stop the service (or make sure no writes are in progress) and copy the directory. Restoring it restores inventory, Wiki content, images, sessions, and login-attempt records.

## Security notes

- Password verification happens on the server. The browser receives an HttpOnly, SameSite=Strict session cookie after a successful login.
- Sessions are stored in SQLite with the login IP address and a 30-day expiration.
- Five failed login attempts from one tracked IP create a one-month ban.
- This is a small self-hosted access gate, not a multi-user identity provider. Put the service behind HTTPS when it is reachable outside a trusted local network.

## Project layout

```text
app/controllers/      Pages (items, wiki, settings, uploads, sessions) and api/ JSON endpoints
app/models/           Item, Manufacturer, Tag, WikiPage, AuthSession, LoginAttempt, Upload
app/views/            ERB views (Turbo Frames for the item sheet, search and wiki list)
app/javascript/       Stimulus controllers and small request helpers
app/assets/tailwind/  Tailwind + daisyUI theme
db/migrate/           Schema (also adopts databases from the Deno version)
```

# Demo

https://github.com/user-attachments/assets/9d398e52-aa28-4017-bf23-60bc3b5d39e8
