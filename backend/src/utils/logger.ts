import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  let log = `${ts} [${level}]: ${message}`;
  if (stack) log += `\n${stack}`;
  const rest = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return log + rest;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    new winston.transports.File({ filename: 'logs/errors.log', level: 'error', maxsize: 5_242_880, maxFiles: 5 }),
    new winston.transports.File({ filename: 'logs/system.log', maxsize: 5_242_880, maxFiles: 5 }),
  ],
});
