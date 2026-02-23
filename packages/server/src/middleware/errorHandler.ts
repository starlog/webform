import type { ErrorRequestHandler } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        requestId: req.id,
      },
    });
    return;
  }

  if (err.name === 'ZodError') {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        details: err.issues,
        requestId: req.id,
      },
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: {
        message: 'Invalid JSON',
        requestId: req.id,
      },
    });
    return;
  }

  console.error(`[error] requestId=${req.id}`, err);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      requestId: req.id,
    },
  });
};
