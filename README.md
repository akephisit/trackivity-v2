# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Docker

- Build and run app + Postgres:
  - `docker compose up --build`
- Run DB migrations (one-off):
  - `docker compose run --rm migrate`
- Runtime environment (set in `docker-compose.yml`):
  - `DATABASE_URL=postgresql://postgres:Phlslt2571Ake@db:5432/trackivity`
  - `JWT_SECRET=trackivity_super_secret_jwt_key_2024_secure_auth_system`

Note: The server uses SvelteKit `$env/dynamic/private`, so you can change environment variables without rebuilding the image. Update `docker-compose.yml` and re-run `docker compose up`.
