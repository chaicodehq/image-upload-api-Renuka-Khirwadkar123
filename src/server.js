import { createApp } from './app.js';
import { connectDB } from './db/connect.js';

async function start() {
  try {
    // TODO: Read PORT from process.env, default to 3000
    const port = undefined;

    // TODO: Read MONGO_URI from process.env, default to "mongodb://localhost:27017/image_upload_api"
    const uri = undefined;

    await connectDB(uri);
    const app = createApp();

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
