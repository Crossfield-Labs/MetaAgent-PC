import { DESKTOP_REMOTE_API_HOST, DESKTOP_REMOTE_API_PORT } from '../config.js';
import { startDesktopRemoteApi } from './remote-api.js';
import { logger } from '../logger.js';

async function main(): Promise<void> {
  const server = await startDesktopRemoteApi();

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down desktop remote API');
    server.close((err) => {
      if (err) {
        logger.error({ err, signal }, 'Failed to close desktop remote API');
        process.exitCode = 1;
      }
      process.exit();
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  logger.info(
    {
      host: DESKTOP_REMOTE_API_HOST,
      port: DESKTOP_REMOTE_API_PORT,
    },
    'Desktop-only remote control server is running',
  );
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start desktop-only remote control server');
  process.exit(1);
});
