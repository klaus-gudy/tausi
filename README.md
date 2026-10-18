# Web Starter

A Next.js starter with Postgres, Prisma, email and password accounts, organizations with roles, and invitations.

Everything runs in Docker, in development too: the app, the database, migrations, Prisma commands, type checks and lint, so everyone runs the same Node.js and the same dependencies. On your machine you need Docker, plus Node.js 20 or newer to run the one-time setup.

## Starting a project from this template

### 1. Get a copy

- **As a GitHub template (recommended):** turn on **Settings → General → Template repository** once for this repo. Then click **Use this template → Create a new repository** for every new project, and clone the new repository. It starts with fresh history, and the template itself stays unchanged.
- **Or clone it and start new history:**

  ```bash
  git clone --depth 1 https://github.com/klaus-gudy/web-starter.git my-app
  cd my-app && rm -rf .git && git init
  ```

Either way the copy contains no credentials: `.env` is git-ignored, and only `.env.example` (placeholders) is committed.

### 2. Run the interactive setup

```bash
npm install     # optional for setup, which has no dependencies; your editor needs it
npm run setup
```

```
Welcome to Project Initializer

? Project name (my-app) inventory-app
? Application display name (Inventory App)
? Next.js application port (3000) 3002
? PostgreSQL host port (5432) 5440
? Database name (inventory_app) inventory_db
? Database username (inventory_app) inventory_user
? Generate a secure database password? (Y/n)
? Docker Compose project name (inventory-app)
? Prisma Studio host port (5555)
? Start Prisma Studio with every `docker compose up`? (y/N)
? Start Docker services after setup? (Y/n)

Checking project configuration...
✔ Project name validated (inventory-app)
✔ Application port 3002 available
✔ PostgreSQL port 5440 available
✔ Prisma Studio port 5555 available
✔ Environment configuration generated (.env)
✔ Docker configuration validated
✔ Project metadata updated (package.json, package-lock.json, app/layout.tsx, README.md, .claude/launch.json)
```

Each question has a default; press Enter to accept it. Setup checks every answer, and ports in particular (see [Ports](#ports)). Nothing is written until all answers are valid and you confirm, and then every file is written together. Press Ctrl+C at any point to stop without changes.

What setup writes:

| File | What changes |
|---|---|
| `.env` | Generated from `.env.example` with your answers, plus the derived `DATABASE_URL` / `DOCKER_DATABASE_URL`. Readable only by you (mode 600). |
| `package.json`, `package-lock.json` | `name` |
| `app/layout.tsx` | `metadata.title`, and `description` while it's still create-next-app's default |
| `README.md` | The heading, while it's still the template's |
| `.claude/launch.json` | The `dev` and `studio` preview ports |

Nothing else is search-and-replaced. Afterwards, replace `app/favicon.ico` yourself and commit the renamed files.

For scripts and CI, every question also has a flag. `npm run setup -- --help` lists them, for example:

```bash
npm run setup -- --yes --name inventory-app --port 3002 --db-port 5440
```

`--yes` takes the defaults for anything you don't pass and never asks; `--dry-run` shows what would change without writing. A custom database password can come from `SETUP_DB_PASSWORD` in the environment, so it never appears in your shell history as a flag.

### 3. Start it

```bash
docker compose up --build -V
```

Compose starts Postgres first. The `migrate` service waits until Postgres passes its health check, applies the committed migrations with `prisma migrate deploy` (which never drops or resets anything), and exits. The app starts only after that succeeds. The first start also builds the images and installs dependencies inside them. Open the `NEXT_PUBLIC_APP_URL` address and sign up: the first account creates the first organization and owns it.

If you answered yes to "Start Docker services after setup?", this already ran in the background (`docker compose logs -f web` shows the app).

## Changing the configuration later

```bash
npm run configure
```

It asks the same questions with your current values as defaults, shows which `.env` values change (secrets masked), and asks before writing. It saves the previous file as `.env.backup-<timestamp>` (git-ignored). Variables you added to `.env` yourself are kept. Running `npm run setup` again on a configured project offers to do the same and changes nothing unless you say yes; with `--yes` it refuses.

Two things to know about an existing database:
- **Postgres reads `DB_NAME`, `DB_USER` and `DB_PASSWORD` only when its volume is first created.** Changing them later doesn't change the database, so the app can no longer log in. `configure` keeps the current password by default and warns when the volume already exists.
- **Changing `COMPOSE_PROJECT_NAME` gives you a new, empty volume.** The old volume is kept, never deleted. Remove it yourself with `docker volume rm <old-name>_db-data` once you don't need it.

## Ports

Each project publishes three host ports, all set in `.env`: `PORT` (the app), `DB_PORT` (Postgres) and `STUDIO_PORT` (Prisma Studio). Inside Docker the app always listens on 3000 and Postgres on 5432, and the containers reach each other by service name (`db:5432`), so only these three host ports differ between projects.

To change a port safely, run `npm run configure` rather than editing `.env`. It checks the new port, moves `NEXT_PUBLIC_APP_URL` along with `PORT` (unless you set a real domain there), and updates the derived `DATABASE_URL`. Then restart with `docker compose up --build -V`.

How setup checks a port:
- It must be between 1024 and 65535, and different from the project's other two ports.
- Nothing on your machine may be listening on it. Setup tries to bind it on all addresses and connect to it, which works on macOS and Linux.
- No Docker container may publish it, **including stopped containers**, which take their ports back when started. Containers of the project you're configuring are allowed, since they're the ones that will use it.
- If a port is taken, setup says by what (e.g. `Port 5433 is used by web-starter-db-1 (project web-starter)`) and offers the next free port.

A port that was free during setup isn't reserved. If something takes it before you start the project, `docker compose up` fails with `port is already allocated`.

### Troubleshooting port conflicts

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'   # ports held by containers
lsof -nP -iTCP:5432 -sTCP:LISTEN                                     # who listens on a port (macOS/Linux)
```

Then stop that project (`docker compose down` in its folder) or stop the local service (such as a Homebrew Postgres on 5432). Or run `npm run configure` and pick another port.

## Running several projects side by side

Docker Compose prefixes everything it creates with `COMPOSE_PROJECT_NAME`: the containers (`inventory-app-db-1`), the network (`inventory-app_default`), the database volume (`inventory-app_db-data`) and the images (`inventory-app-dev`). No container names are hardcoded. Projects with different project names and ports therefore run at the same time without sharing anything, each with its own database. Setup gives every project its own name and checks ports against everything already running.

## Environment variables

`.env.example` is the documented template and is committed. `.env` holds the real values and is git-ignored (so are the backups). Docker Compose reads `.env` for the `${...}` values in the Compose files, and `env_file: .env` passes it to the containers. Next.js and `prisma.config.ts` read the same file when running on your machine.

| Variable | Used for |
|---|---|
| `COMPOSE_PROJECT_NAME` | Prefix for containers, network, volume and images |
| `PORT` | Host port of the app; in the container it's always 3000 |
| `NEXT_PUBLIC_APP_URL` | The address people open; invitation links use it. Baked in at build time |
| `DB_HOST`, `DB_PORT` | Postgres as seen from your machine (`localhost`, published port). Compose overrides them with `db` and `5432` inside containers |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | The database and its owner; Postgres reads them when its volume is created |
| `DB_SCHEMA` | Postgres schema for the app's tables (default `app`) |
| `DATABASE_URL` | Derived URL for tools on your machine, with the credentials URL-escaped |
| `DOCKER_DATABASE_URL` | Derived URL for containers (`db:5432`); Compose passes it to them as `DATABASE_URL` |
| `STUDIO_PORT`, `COMPOSE_PROFILES` | Prisma Studio's host port; `COMPOSE_PROFILES=tools` starts Studio with every `up` |

The app and Prisma connect with the `DB_*` values (`lib/db.ts`, `prisma.config.ts`). The two URLs are only for other tools, which is why the host-vs-container difference is only `DB_HOST`/`DB_PORT`. If you edit `DB_*` by hand, run `npm run configure` afterwards to bring the URLs up to date. Values containing anything beyond letters, digits and `-_.:/@?=&%+,` are written in single quotes, which Docker Compose, Node.js and Next.js all read literally.

## How the Docker setup works

- `docker-compose.yml` is the production setup: the `db` service, a one-off `migrate` service that runs `prisma migrate deploy` and exits, and the `web` app, which starts only after `migrate` succeeds. `db` and `web` have health checks (`pg_isready`, and a request to `/login`).
- `docker-compose.override.yml` turns it into the development setup. Docker Compose loads it automatically, so a plain `docker compose ...` command is always development: `web` runs `next dev` with your source folder mounted for hot reload. It also defines `studio`, which only starts when you ask for it.
- `node_modules` lives inside the container, not in your folder, so it always matches the container's Linux and Node.js versions.

### Running the app on your machine instead

If you'd rather run `next dev` outside Docker (after `npm install`):

```bash
npm run dev:local
```

It starts only Postgres in Docker, waits until it's healthy, applies migrations, generates the Prisma client and runs `next dev` on your `PORT`, connecting to Postgres at `localhost:DB_PORT`. Stop the Docker `web` service first if it's running, since both use `PORT`.

## Everyday commands

Run these from the project folder.

```bash
docker compose up --build -V          # start app + database with hot reload (Ctrl+C to stop)
docker compose down                   # remove the containers (data is kept)
docker compose down -v                # remove the containers and all data (fresh database)

docker compose exec web npm run typecheck   # type check
docker compose exec web npm run lint        # lint
docker compose up studio                    # Prisma Studio at http://localhost:5555 (STUDIO_PORT)
npm run db:status                           # which migrations are applied
npm test                                    # tests for the setup CLI

docker compose -f docker-compose.yml up --build   # run the production build locally
```

`--build` rebuilds the image when the Dockerfile or dependencies changed, and `-V` gives the container a fresh `node_modules` from that image; both are quick when nothing changed. `exec` commands need the app running (`docker compose up` in another terminal). In Prisma Studio, pick the `app` schema (or your `DB_SCHEMA`) at the top left.

The same commands exist as npm scripts (`npm run dev`, `npm run dev:down`, `npm run db:migrate`, `npm run db:studio`, `npm run db:status`), which call Docker for you.

Edits under `app/`, `components/` and `lib/` reload automatically. You need to do something yourself in these cases:

- **Adding a dependency:** `docker compose exec web npm install <package>` (add `-D` for a dev dependency). It updates `package.json` and `package-lock.json` in your folder and installs it in the running container; commit both files. Everyone else gets it on their next `docker compose up --build -V`.
- **After pulling changes to dependencies:** `docker compose up --build -V`.
- **After changing `NEXT_PUBLIC_*` variables:** restart, and rebuild for production: they're baked in at build time.
- **After adding or changing `instrumentation.ts`:** restart; it's only loaded at startup.
- **After editing `prisma/schema.prisma`:** create a migration (see below), then commit the new folder under `prisma/migrations`. Everyone else gets it applied automatically on their next start.

**On Linux:** the dev container runs as root, so files it creates in your folder (new migrations, `package-lock.json`, `lib/generated`) end up owned by root. Take them back with `sudo chown -R "$USER": .` when your editor can't save them. Docker Desktop on macOS and Windows maps ownership for you.

**Editor support:** your editor's TypeScript features need `node_modules` in the folder. Either open the project in the container with VS Code's Dev Containers extension ("Attach to Running Container", folder `/app`), or, if you have Node.js, run `npm install` on your machine for the editor only. Running the app still happens in Docker either way.

## Before going to production

- **Run only the base file:** `docker compose -f docker-compose.yml up -d --build`. Without `-f`, Compose also loads the development override.
- **Build with the real address:** set `NEXT_PUBLIC_APP_URL` to the public URL before building the image.
- **Use HTTPS:** in production the session cookie is `Secure`, so logging in only works over HTTPS (browsers make an exception for `localhost`).
- **Put a reverse proxy in front** that sets `X-Forwarded-For` and strips any value the client sent. Rate limits and session IPs use it, and without such a proxy clients can fake their IP.
- **Use a strong `DB_PASSWORD`**, and don't publish the database port publicly (remove `ports:` from the `db` service if nothing outside Docker needs it).
- **Connect an email provider** in `lib/mailer.ts` if you want invitations emailed. Until then, people share invitation links themselves.
- **Back up the `db-data` volume.** `docker compose down -v` deletes it.

## Database with Prisma

Prisma connects with the same `DB_*` variables from `.env` (see `prisma.config.ts`), not `DATABASE_URL`, which is only there for other tools. Models go in `prisma/schema.prisma`; the app uses them through `getPrisma()` from `lib/prisma.ts`, which runs on the same `pg` pool as `query()`.

With the app running:

```bash
# Create and apply a migration after editing the schema. It asks for a name.
docker compose exec web sh -c "npx prisma migrate dev && npx prisma generate"

# Regenerate the client into lib/generated/prisma (also done on every start).
docker compose exec web npx prisma generate
```

Committed migrations are applied automatically by the `migrate` service on every start, in development and production, once Postgres is healthy. To apply them without starting the app, run `docker compose run --rm migrate`. `npm run db:status` shows which migrations the configured database has. Setup never runs migrations, resets the database or deletes volumes; `docker compose down -v` is the only command here that deletes data. The Postgres schema named by `DB_SCHEMA` is created the first time the database volume is initialised.

## Authentication and tenancy

Sign-up has two steps: first an organization name, checked against existing organizations (names are unique, ignoring case), then name, email and password. It creates the user, the organization and their owner membership in one transaction, then signs them in. An email that already has an account can still sign up with that account's password to create an organization, unless it already owns one. From an invitation link there is no organization step: signing up (or entering an existing account's password) accepts the invitation and gives the invited role. Sessions live in the `sessions` table; the `session` cookie holds a random token whose SHA-256 hash is stored, and passwords are hashed with scrypt (`lib/password.ts`).

- In components, call `getCurrentUser()` from `lib/auth.ts` behind a `<Suspense>` boundary. It returns the user and their active organization, or redirects to `/login`.
- In server actions, authorize with `readSession()` from `lib/session.ts`.
- `proxy.ts` only checks that the cookie exists, sending visitors without one to `/login`. Signed-in visitors who open `/login` or `/sign-up` are sent on to the dashboard (or their `?next=` path) after the session is checked in the database.
- For what the user may do in their active organization, call `readActiveMember()` from `lib/membership.ts` and check `permissions.has("members.invite")` and the like.

Members are managed at `/members`, which lists only the active organization's members: invite by email with a role, change roles, remove members or leave. An organization always keeps at least one owner. Inviting creates a link (`/invite/<token>`) that is copied for you to send yourself; no email goes out yet (`lib/mailer.ts` is a stub for when you connect a provider). Links work once and expire after 7 days. The sidebar's organization menu switches between the organizations you belong to; the user menu in the footer holds log out.

### Rate limits

Login, sign-up and the organization name check are rate-limited (`lib/rate-limit.ts`), with counters in the `rate_limits` table so limits hold across restarts and instances. Limits are per IP address, and password checks are also limited per email across login and sign-up. The numbers live in `LIMITS` in `app/(auth)/actions.ts`. The IP comes from `X-Forwarded-For`: in production, run behind a proxy that sets it and strips any value sent by the client.

### Cleanup

Each server process runs `cleanUpExpired()` (`lib/cleanup.ts`) a minute after it starts and then hourly, from `instrumentation.ts`. It deletes expired sessions, rate-limit counters and verification tokens, and marks pending invitations past their expiry as `expired`. Running several instances is fine: every step is idempotent.

### Errors

`app/(core)/error.tsx` handles errors in signed-in pages and keeps the sidebar; `app/error.tsx` covers the rest; `app/global-error.tsx` replaces the root layout if it fails; `app/not-found.tsx` is the 404 page for unknown URLs and `notFound()`.
