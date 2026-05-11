import { redirect } from 'next/navigation';
import { getCurrentStaff } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { SkinAnalyzerView } from '@/components/skin-analysis/analyzer-view';

export const dynamic = 'force-dynamic';

export default async function SkinAnalysisPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');

  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <PageHeader
        title="肌分析"
        description="顔写真から 6 項目の肌指標 (色ムラ・赤み・キメ・シミ・ハリ・水分) をスコア化します"
      />
      <SkinAnalyzerView />
    </div>
  );
}
