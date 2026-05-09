import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { ConversationList } from '@/components/messages/conversation-list';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MessageCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const supabase = createClient();
  const { data: conversations } = await supabase
    .from('line_conversations')
    .select('*')
    .order('last_sent_at', { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="LINE メッセージ"
        description="お客様との公式 LINE のやりとりをここで管理します"
      />
      {(conversations ?? []).length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<MessageCircle size={28} />}
              title="まだメッセージがありません"
              description="お客様が公式 LINE にメッセージを送ると、ここに会話が表示されます"
            />
          </CardContent>
        </Card>
      ) : (
        <ConversationList conversations={(conversations ?? []) as any} />
      )}
    </div>
  );
}
