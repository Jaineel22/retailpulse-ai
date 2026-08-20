const env = require('./config/env');
const { connectDB } = require('./config/db');
const app = require('./app');

async function start() {
  try {
    await connectDB(env.mongodbUri);
    console.log('MongoDB connected');

    app.listen(env.port, () => {
      console.log(`RetailPulse AI API listening on port ${env.port} (${env.nodeEnv})`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
