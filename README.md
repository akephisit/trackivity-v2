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

## Docker (Bun)

Build and run a Bun-optimized container using the provided Dockerfile:

```sh
# Build image
docker build -t trackivity-bun .

# Run container (adjust envs as needed)
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgres://postgres:password@host.docker.internal:5433/trackivity" \
  --name trackivity trackivity-bun
```

Notes:
- The image uses `oven/bun` and `svelte-adapter-bun`.
- Container runs `bun start` from the built `build/` directory.
- Configure environment variables via `-e` flags or Compose.
- A `docker-compose.yml` for Postgres already exists; point `DATABASE_URL` to it.
