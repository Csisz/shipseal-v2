import type { IncomingMessage, ServerResponse } from 'node:http';

const plannedResponse = {
  status: 'not_implemented',
  message: 'GitHub App connection is planned. Use temporary token mode for now.',
};

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 501;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(plannedResponse));
}
