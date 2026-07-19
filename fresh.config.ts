import { defineConfig } from '$fresh/server.ts';

export default defineConfig({
	server: {
		port: Number(Deno.env.get('PORT') ?? 8000),
	},
});