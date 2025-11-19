// Service Worker Básico para Invest Portfolio
const CACHE_NAME = 'invest-portfolio-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Estratégia Network-First simplificada para garantir dados frescos da API Gemini
  // Para assets estáticos, idealmente usaríamos Cache-First
  if (event.request.url.includes('generativelanguage.googleapis.com')) {
      return; // Não cachear chamadas de API
  }
});