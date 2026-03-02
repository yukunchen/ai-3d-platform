import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

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
      <body>
        <nav style={{
          display: 'flex',
          gap: '1.5rem',
          padding: '0.75rem 2rem',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}>
          <Link href="/" style={{ textDecoration: 'none', color: '#111827', fontWeight: 500 }}>
            Generator
          </Link>
          <Link href="/history" style={{ textDecoration: 'none', color: '#111827', fontWeight: 500 }}>
            History
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
