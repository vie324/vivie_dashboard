import { redirect } from 'next/navigation';
import { getCurrentStaff } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  return <DashboardShell staff={staff}>{children}</DashboardShell>;
}
