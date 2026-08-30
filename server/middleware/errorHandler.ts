import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError } from '@apprentorbay/shared';

export const notFound: RequestHandler = (req, res) => {
  const error: ApiError = {
    code: 'not_found',
    message: `No route for ${req.method} ${req.path}`,
  };
  res.status(404).json({ error });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const error: ApiError = {
    code: 'internal',
    message: 'Something went wrong',
  };
  res.status(500).json({ error });
};
