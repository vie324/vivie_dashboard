import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP, Shippori_Mincho } from 'next/font/google';
import { SplashScreen } from '@/components/ui/splash-screen';
import './globals.css';

const notoSansJp = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-noto-sans-jp',
});

const shippori = Shippori_Mincho({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-shippori',
});

export const metadata: Metadata = {
  title: 'vivie',
  description: 'エステサロン vivie の統合管理ダッシュボード',
  applicationName: 'vivie',
  icons: {
    icon: '/vivie-logo.png',
    apple: '/vivie-logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#DCA9A8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} ${shippori.variable}`}>
      <body className="font-sans">
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
