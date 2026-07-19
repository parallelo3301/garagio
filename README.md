# Garagio

Garagio is a lightweight, self-hosted inventory manager for workshop and garage tools. It runs as a Deno Fresh application and can be compiled into a single executable.

It is designed for a phone in the workshop, while remaining comfortable on a desktop or tablet.

## Features

- Inventory items with quantity, location, manufacturer, tags, status, borrowing details, photos, and external links.
- Photo uploads stored locally in `uploads/` with image thumbnails in the inventory list.
- Wiki pages with search, Markdown preview, image upload/drop, plain URL auto-linking, editing, and deletion.
- Bidirectional item/Wiki relationships: open Wiki pages from an item and linked inventory from a Wiki page.
- Password-protected application and API access.
- SQLite-backed sessions that survive web-server restarts, with a 30-day expiry and login IP address storage.
- Automatic IP ban for five failed password attempts; bans expire after one month.
- Automatic, transactional SQLite migrations at startup.
- Portable data: back up `db.sqlite` and `uploads/` together.

## Requirements

For development:

- [Deno](https://deno.com/runtime) 2.x
- Node.js and [pnpm](https://pnpm.io/) for Tailwind CSS builds

For deployment from a compiled binary, Deno and Node.js are not required on the server.

## Quick Start

```bash
pnpm install
cp .env.example .env
```

Set a real value for `ACCESS_PASSWORD` in `.env`, then start the development server:

```bash
pnpm dev
```

Open `http://localhost:8000` and sign in with the password from `.env`.

The first launch creates `db.sqlite`, creates `uploads/`, and runs all pending database migrations automatically.

## Configuration

Garagio reads its configuration from `.env`. The file is ignored by Git; use `.env.example` as the template.

```env
ACCESS_PASSWORD=change-this-to-a-long-password
PORT=8000
TRUST_PROXY=false
```

| Variable | Description |
| --- | --- |
| `ACCESS_PASSWORD` | Required password for application access. Change it before deployment. |
| `PORT` | HTTP listen port. Defaults to `8000` if not set. |
| `TRUST_PROXY` | Set to `true` only when Garagio is behind a trusted reverse proxy. It then uses the first `X-Forwarded-For` value, falling back to `X-Real-IP`, for login IP tracking and bans. |

Do not enable `TRUST_PROXY=true` when the service is directly reachable from untrusted clients: forwarded IP headers can be forged without a reverse proxy that removes them.

## Development Commands

```bash
pnpm dev                 # Start Fresh and automatically rebuild CSS on changes
pnpm check               # Type-check the app
pnpm build               # Build a native executable for the current platform
pnpm build:linux         # Cross-compile an x86_64 GNU/Linux executable
pnpm migrate:create add_feature_name
```

Edit Tailwind utility classes in the Preact components or add global CSS to `styles/tailwind.css`. `static/styles.css` is the generated, minified stylesheet served by the app and should remain committed so the source checkout works before a CSS build. `pnpm dev` rebuilds it automatically; `pnpm build` also regenerates it before compiling the executable.

`pnpm build:linux` produces `workshop-inventory-linux`, targeting `x86_64-unknown-linux-gnu`. It is suitable for an x86_64 Ubuntu 22.04 deployment host.

## Deploying to Ubuntu

Build the Linux executable on your development machine:

```bash
pnpm build:linux
```

Copy these to a dedicated directory on the Ubuntu host:

```text
workshop-inventory-linux
.env
```

Make it executable and run it from that directory:

```bash
chmod +x workshop-inventory-linux
./workshop-inventory-linux
```

Garagio creates `db.sqlite` and `uploads/` alongside the executable's launch directory. Keep the executable, `.env`, database, and uploads in a directory writable by the deployment user.

For reverse-proxy deployment, point the proxy to `http://127.0.0.1:8000`, configure the proxy to set `X-Forwarded-For`, and set `TRUST_PROXY=true` in `.env`.

## Data and Backups

All mutable application data lives in two places:

```text
db.sqlite
uploads/
```

To back up Garagio, stop the service or ensure no writes are in progress, then copy both paths together. Restoring those two paths restores inventory, Wiki content, uploaded images, sessions, and login-attempt records.

## Security Notes

- Password verification happens on the server. The browser receives an HttpOnly session cookie after a successful login.
- Sessions are stored in SQLite with the IP address used during login and a 30-day expiration.
- Five failed login attempts from one tracked IP create a one-month ban.
- This is a small self-hosted access gate, not a multi-user identity provider. Put the service behind HTTPS when it is reachable outside a trusted local network.

## Migrations

SQL migrations live in `db/migrations/` and are applied once, in numeric order, on application startup. Applied versions are recorded in the `migrations` table.

Create a new migration with:

```bash
pnpm migrate:create meaningful_change_name
```

Keep migrations small and test them against a copy of a real database before deployment.

## Project Layout

```text
config/          Environment and authentication helpers
db/              SQLite connection, migration runner, and SQL migrations
islands/         Interactive Preact UI
routes/          Fresh pages and API routes
static/          Compiled CSS and static assets
uploads/         Runtime photo storage (created automatically)
```
