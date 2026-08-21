const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const routes = require('./routes');
const notFound = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Disabled under test so the Jest/Supertest suite (hundreds of requests per
// run) never trips the limiter — this mirrors how the prediction cron is
// disabled under NODE_ENV=test elsewhere in the app.
if (env.nodeEnv !== 'test') {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many authentication attempts, please try again later' },
  });

  app.use('/api/auth', authLimiter);
  app.use('/api', apiLimiter);
}

app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'RetailPulse AI API is healthy' });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
