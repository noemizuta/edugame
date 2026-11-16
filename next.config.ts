import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // firebase-admin solo corre en el servidor (Route Handlers).
  serverExternalPackages: ['firebase-admin'],
  // Una sola variable decide el uso de emuladores; el cliente la recibe con prefijo público.
  env: { NEXT_PUBLIC_USE_FIREBASE_EMULATOR: process.env.USE_FIREBASE_EMULATOR ?? '' },
  // Ingreso por redirección en navegadores que bloquean el almacenamiento de terceros:
  // el controlador de Firebase Auth se sirve desde el mismo dominio del sitio. Solo tiene
  // efecto si NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN es el dominio del sitio (ver README, fase 7).
  async rewrites() {
    const proyecto = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!proyecto || process.env.USE_FIREBASE_EMULATOR === 'true') return [];
    return [{ source: '/__/auth/:ruta*', destination: `https://${proyecto}.firebaseapp.com/__/auth/:ruta*` }];
  },
};

export default nextConfig;
