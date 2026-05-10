'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { useToast } from '@/components/ui/toast';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Mail,
  PlayCircle,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface Settings {
  email_address: string | null;
  is_active: boolean;
  history_id: string | null;
  watch_expiration: string | null;
  last_received_at: string | null;
  last_error: string | null;
  connected_at: string | null;
  connected_staff?: { display_name: string } | null;
}

interface InboundEmail {
  id: string;
  message_id: string;
  sender: string;
  subject: string;
  received_at: string;
  parser_used: string | null;
  status: string;
  error_message: string | null;
  reservation: { id: string; customer_name: string } | null;
}

interface Props {
  settings: Settings | null;
  emails: InboundEmail[];
  config: {
    oauth_client_set: boolean;
    pubsub_topic_set: boolean;
    pubsub_token_set: boolean;
    app_url: string | null;
    pubsub_topic: string | null;
    pubsub_token: string | null;
  };
}

export function GmailSettingsView({ settings, emails, config }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [testForm, setTestForm] = useState({ sender: '', subject: '', body: '' });
  const [testResult, setTestResult] = useState<any>(null);

  const tokenForUrl = config.pubsub_token
    ? encodeURIComponent(config.pubsub_token)
    : 'YOUR_TOKEN';
  const watchUrl = config.app_url
    ? `${config.app_url}/api/inbound/gmail?token=${tokenForUrl}`
    : `/api/inbound/gmail?token=${tokenForUrl}`;
  const oauthStartUrl = '/api/gmail/oauth/start';

  const watchActive =
    settings?.is_active &&
    settings.watch_expiration &&
    new Date(settings.watch_expiration) > new Date();

  async function startWatch() {
    setBusy('watch');
    try {
      const res = await fetch('/api/gmail/watch', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '失敗');
      toast.show('Watch を開始しました', 'success');
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '失敗', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function testParse() {
    setBusy('test');
    setTestResult(null);
    try {
      const res = await fetch('/api/gmail/test-parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(testForm),
      });
      setTestResult(await res.json());
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* 全体状況 */}
      <Card
        className={
          watchActive
            ? 'border-emerald-200 bg-emerald-50/40'
            : settings?.email_address
              ? 'border-amber-200 bg-amber-50/40'
              : 'border-ink-200'
        }
      >
        <CardContent className="flex items-start gap-3 p-5">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
              watchActive
                ? 'bg-emerald-100 text-emerald-600'
                : settings?.email_address
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-ink-100 text-ink-500'
            }`}
          >
            {watchActive ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          </span>
          <div className="flex-1">
            <p className="font-medium">
              {watchActive
                ? 'Gmail 連携は稼働中'
                : settings?.email_address
                  ? '認証は完了しました。Watch を開始してください'
                  : '未連携'}
            </p>
            {settings?.email_address && (
              <p className="text-sm text-ink-700 mt-0.5">
                <Mail size={12} className="inline -mt-0.5 mr-1" />
                {settings.email_address}
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
              <Stat label="接続日時" value={settings?.connected_at ? formatDateTime(settings.connected_at).slice(0, 10) : '—'} />
              <Stat label="Watch 期限" value={settings?.watch_expiration ? formatDateTime(settings.watch_expiration) : '未開始'} />
              <Stat label="最終受信" value={settings?.last_received_at ? formatDateTime(settings.last_received_at) : '—'} />
              <Stat label="historyId" value={settings?.history_id ?? '—'} mono />
            </div>
            {settings?.last_error && (
              <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                直近エラー: {settings.last_error}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 環境変数チェック */}
      <Card>
        <CardHeader>
          <CardTitle>環境変数チェック</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <CheckRow
            ok={config.oauth_client_set}
            label="GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET"
            help="Google Cloud Console > APIs & Services > Credentials"
          />
          <CheckRow
            ok={config.pubsub_topic_set}
            label="GMAIL_PUBSUB_TOPIC"
            help={`例: projects/xxx/topics/gmail-vivie ${config.pubsub_topic ? `(現在: ${config.pubsub_topic})` : ''}`}
          />
          <CheckRow
            ok={config.pubsub_token_set}
            label="GMAIL_PUBSUB_VERIFICATION_TOKEN"
            help="Pub/Sub Push の URL に ?token= で付与する共有トークン (任意だが推奨)"
          />
          <CheckRow
            ok={!!config.app_url}
            label="NEXT_PUBLIC_APP_URL"
            help={config.app_url ?? '未設定'}
          />
        </CardContent>
      </Card>

      {/* 操作 */}
      <Card>
        <CardHeader>
          <CardTitle>操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <a href={oauthStartUrl}>
              <Button size="md" variant={settings?.email_address ? 'secondary' : 'primary'}>
                <Mail size={14} />
                {settings?.email_address ? 'Gmail 認証をやり直す' : 'Gmail と連携'}
              </Button>
            </a>
            <Button
              size="md"
              onClick={startWatch}
              disabled={busy === 'watch' || !settings?.email_address}
            >
              {busy === 'watch' ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
              Watch 開始 / 更新
            </Button>
            <Button
              size="md"
              variant="ghost"
              onClick={() => router.refresh()}
            >
              <RefreshCw size={14} />
              再読込
            </Button>
          </div>

          {/* Pub/Sub Push URL */}
          <div className="rounded-xl bg-ink-50/40 border border-ink-100 p-3">
            <p className="text-xs font-medium text-ink-500 mb-1.5">
              Pub/Sub Push エンドポイント (Subscription 設定)
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-white border border-ink-200 px-2 py-1.5 text-xs font-mono">
                {watchUrl}
              </code>
              <CopyButton value={watchUrl} />
            </div>
            <p className="mt-1 text-[10px] text-ink-400">
              {config.pubsub_token
                ? 'この URL をそのまま Pub/Sub Subscription の Push エンドポイントに登録してください'
                : 'GMAIL_PUBSUB_VERIFICATION_TOKEN を設定すると、URL に実トークンが埋め込まれます'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* テストパーサ */}
      <Card>
        <CardHeader>
          <CardTitle>テストパーサ</CardTitle>
          <p className="text-xs text-ink-500 mt-1">
            実メールを送る前に、本文を貼り付けてパース結果を確認できます
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="From">
              <Input
                value={testForm.sender}
                onChange={(e) => setTestForm((f) => ({ ...f, sender: e.target.value }))}
                placeholder="reserve@hairsalons.beauty.hotpepper.jp"
              />
            </Field>
            <Field label="件名">
              <Input
                value={testForm.subject}
                onChange={(e) => setTestForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="【ホットペッパービューティー】予約成立のお知らせ"
              />
            </Field>
          </div>
          <Field label="本文">
            <Textarea
              rows={8}
              value={testForm.body}
              onChange={(e) => setTestForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="ご予約日時: 2026年5月15日 14:00&#10;お客様氏名: 山田 花子 様&#10;..."
              className="font-mono text-xs"
            />
          </Field>
          <div className="flex justify-end">
            <Button onClick={testParse} disabled={busy === 'test' || !testForm.body.trim()} size="sm">
              {busy === 'test' && <Loader2 size={14} className="animate-spin" />}
              パースを試す
            </Button>
          </div>
          {testResult && (
            <pre className="rounded-xl bg-ink-50 border border-ink-100 p-3 text-xs overflow-auto max-h-80">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* 受信ログ */}
      <Card>
        <CardHeader>
          <CardTitle>直近の受信メール (最大 30 件)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {emails.length === 0 ? (
            <p className="text-center py-8 text-sm text-ink-400">
              まだ受信したメールはありません
            </p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>受信</th>
                  <th>From</th>
                  <th>件名</th>
                  <th>パーサ</th>
                  <th>状態</th>
                  <th>予約</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id}>
                    <td className="text-xs text-ink-500 whitespace-nowrap">
                      {formatDateTime(e.received_at)}
                    </td>
                    <td className="text-xs text-ink-600 truncate max-w-[12rem]">{e.sender}</td>
                    <td className="text-xs text-ink-700 truncate max-w-xs">{e.subject}</td>
                    <td className="text-xs">{e.parser_used ?? '—'}</td>
                    <td>
                      <StatusBadge status={e.status} />
                      {e.error_message && (
                        <p className="text-[10px] text-red-600 mt-0.5">{e.error_message.slice(0, 60)}</p>
                      )}
                    </td>
                    <td className="text-xs">
                      {e.reservation ? (
                        <a
                          href={`/reservations/${e.reservation.id}`}
                          className="text-vivie-600 hover:underline"
                        >
                          {e.reservation.customer_name}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CheckRow({
  ok,
  label,
  help,
}: {
  ok: boolean;
  label: string;
  help?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full mt-0.5 ${
          ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      </span>
      <div className="flex-1">
        <p className={`text-sm ${ok ? 'text-ink-900' : 'text-red-700 font-medium'}`}>{label}</p>
        {help && <p className="text-xs text-ink-500 break-all">{help}</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-white border border-ink-100 px-2.5 py-1.5">
      <p className="text-[10px] text-ink-400">{label}</p>
      <p className={`mt-0.5 text-xs ${mono ? 'font-mono' : ''} text-ink-900 truncate`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: any; label: string }> = {
    received: { tone: 'default', label: '受信' },
    parsed: { tone: 'amber', label: '解析中' },
    matched: { tone: 'green', label: '予約作成' },
    unmatched: { tone: 'amber', label: 'パース不可' },
    duplicate: { tone: 'default', label: '重複' },
    error: { tone: 'red', label: 'エラー' },
  };
  const m = map[status] ?? { tone: 'default', label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
