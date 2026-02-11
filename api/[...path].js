import app from '../Backend/index.js';

export const config = {
  runtime: 'nodejs',
};

export default function handler(req, res) {
  return app(req, res);
}
