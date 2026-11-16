import type { Metadata, Viewport } from 'next';
import { ProveedorSesion } from '@/components/Sesion';
import './globals.css';

export const metadata: Metadata = {
  title: 'EduGame RAM · Guardianes del Antibiótico',
  description: 'Aprende, juega y protege los antibióticos. Universidad Nacional del Callao.',
  icons: { icon: '/img/logo-192.png', apple: '/img/logo-192.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b1f4d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE">
      <body>
        <ProveedorSesion>{children}</ProveedorSesion>
      </body>
    </html>
  );
}
