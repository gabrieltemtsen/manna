import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

import { ConsoleShell } from '@/components/layout/ConsoleShell';
import { WalletProvider } from '@/components/wallet/WalletProvider';
import { SessionProvider } from '@/components/session/SessionProvider';

const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Manna — live generosity agent for Circles',
  description:
    'A mission-control console for an autonomous generosity agent. It reads your real Circles trust graph and routes your decaying CRC to people who matter — live, with a reason and a traced path for every gift.',
  openGraph: {
    title: 'Manna — live generosity agent for Circles',
    description:
      'Tell an AI agent your values. It reads your real Circles trust graph and turns your decaying basic income into intentional, traceable gifts.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full">
        <WalletProvider>
          <SessionProvider>
            <ConsoleShell>{children}</ConsoleShell>
          </SessionProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
