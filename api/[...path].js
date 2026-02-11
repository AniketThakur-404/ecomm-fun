import app from '../Backend/index.js';

export default function handler(req, res) {
  return app(req, res);
}
