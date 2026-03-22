import { bootstrap } from './app/bootstrap.js';

bootstrap().catch((error) => {
  const message = `Bootstrap failed: ${error.message}`;
  const target = document.querySelector('#healthOutput');
  if (target) {
    target.textContent = message;
  }
  console.error(error);
});
