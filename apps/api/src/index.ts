import { createQueue } from './queue';
import { createApp } from './app';

const PORT = parseInt(process.env.PORT || '3001', 10);

const queue = createQueue();
const app = createApp(queue);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on port ${PORT}`);
});

export { app, queue };
