import type { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import swaggerUiDist from 'swagger-ui-dist';
import express from 'express';

function isDocsEnabled(): boolean {
  const env = process.env.NODE_ENV ?? 'development';
  return env === 'development' || env === 'staging';
}

export function mountSwaggerUi(app: INestApplication): void {
  if (!isDocsEnabled()) return;

  // NestJS adapter instance (Express) – register as middleware, not controller.
  const server = app.getHttpAdapter().getInstance() as express.Express;

  const openapiPath = resolve(process.cwd(), 'docs/openapi.json');
  const openapiUrl = '/v1/docs/openapi.json';

  server.get(openapiUrl, (_req, res) => {
    const json = readFileSync(openapiPath, 'utf8');
    res.type('application/json').send(json);
  });

  const dist = swaggerUiDist.getAbsoluteFSPath();
  server.use('/v1/docs', express.static(dist, { index: false }));

  server.get('/v1/docs', (_req, res) => {
    res.type('text/html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Motogram API Docs</title>
    <link rel="stylesheet" href="/v1/docs/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/v1/docs/swagger-ui-bundle.js"></script>
    <script src="/v1/docs/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: ${JSON.stringify(openapiUrl)},
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: 'StandaloneLayout'
        });
      };
    </script>
  </body>
</html>`);
  });
}

