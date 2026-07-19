import { defineApp } from '$fresh/server.ts';

export default defineApp((_request, context) => (
  <html lang='en'>
    <head>
      <meta charSet='utf-8' />
      <meta name='viewport' content='width=device-width, initial-scale=1' />
      <title>Garagio</title>
      <link rel='stylesheet' href='/styles.css' />
    </head>
    <body><context.Component /></body>
  </html>
));