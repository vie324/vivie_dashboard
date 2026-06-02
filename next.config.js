/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'items-images-production.s3.us-west-2.amazonaws.com' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  // 型エラー / Lint エラーはビルドで検出する (旧: ignoreBuildErrors はスキーマ型を
  // 完全化したうえで撤廃済み)。
  // 公開カウンセリングフォームは LINE 内蔵ブラウザのキャッシュで
  // 404 などが残ると詰むため、CDN / ブラウザ双方でキャッシュさせない
  async headers() {
    return [
      {
        source: '/counseling/public/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, max-age=0',
          },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          // LINE 内蔵ブラウザ向けに、リファラを保持して
          // openExternalBrowser=1 が剥がれた場合にも検知できるように
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
