const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const routes = require('./routes');
const notFound = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'RetailPulse AI API is healthy' });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
