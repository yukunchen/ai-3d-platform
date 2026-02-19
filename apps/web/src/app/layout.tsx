import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI 3D Model Generator',
  description: 'Generate 3D models from text or images',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
