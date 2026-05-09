import type { Metadata } from 'next';
import './globals.css';
import { MsalProviderWrapper } from './providers';

export const metadata: Metadata = {
  title: 'TEE | Sistema Electoral Estudiantil',
  description: 'Sistema de votacion electronica del Tribunal Electoral Estudiantil del TEC',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body suppressHydrationWarning>
        <MsalProviderWrapper>{children}</MsalProviderWrapper>
      </body>
    </html>
  );
}
