import { LineBrowserBanner } from '@/components/counseling/line-browser-banner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PublicCounselingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LineBrowserBanner />
      {children}
    </>
  );
}
