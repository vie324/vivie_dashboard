'use client';
import { useEffect, useState } from 'react';

// アプリ初回ロード時にスプラッシュスクリーンを表示
// sessionStorage 制御で同じタブ内は 1 回のみ
export function SplashScreen() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = sessionStorage.getItem('vivie-splash-shown');
    if (seen) return;
    setShow(true);
    sessionStorage.setItem('vivie-splash-shown', '1');

    const fadeAt = setTimeout(() => setFading(true), 1500);
    const removeAt = setTimeout(() => setShow(false), 2100);
    return () => {
      clearTimeout(fadeAt);
      clearTimeout(removeAt);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-vivie-300 transition-opacity duration-700 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-hidden
    >
      <div className="flex flex-col items-center gap-6 animate-fade-in-up px-6">
        {!imgFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/vivie-logo.png"
            alt="vivie"
            width={140}
            height={140}
            className="rounded-3xl shadow-xl shadow-black/10"
            onError={() => setImgFailed(true)}
          />
        )}
        <span
          className="font-serif text-white"
          style={{
            fontSize: 'clamp(3rem, 12vw, 5rem)',
            letterSpacing: '0.16em',
          }}
        >
          vivie
        </span>
      </div>
    </div>
  );
}
