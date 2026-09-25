import type { Metadata } from 'next';
import { Work_Sans } from 'next/font/google';
import './globals.css';

const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Nucleo',
  description: 'Analisi finanziaria personale e di coppia',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={workSans.variable}>
      <body>{children}</body>
    </html>
  );
}
