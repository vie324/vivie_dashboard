'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { useToast } from '@/components/ui/toast';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  MessageCircle,
  ArrowDown,
  ArrowUp,
  PlayCircle,
  ExternalLink,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface Diag {
  config: {
    access_token_set: boolean;
    access_token_valid: boolean | null;
    access_token_error: string | null;
    channel_secret_set: boolean;
    webhook_url: string;
    app_url: string;
  };
  counts: {
    total_events: number;
    total_messages: number;
    inbound_messages: number;
  };
  recent_events: any[];
  recent_messages: any[];
}

export function LineAdmin() {
  const toast = useToast();
  const [diag, setDiag] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/line/diagnose');
      const data = await res.json();
      setDiag(data);
    } finally {
      setLoading(false);
    }
  }

  async function runTestEvent() {
    setTesting(true);
    try {
      const res = await fetch('/api/line/test-event', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'failed');
      toast.show('テストイベントを記録しました。診断画面と /messages に反映されます', 'success');
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'テストに失敗しました', 'error');
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && !diag) {
    return (
      <div className="p-6 text-center text-sm text-ink-400">
        <Loader2 className="mx-auto mb-2 animate-spin" size={20} />
        診断中…
      </div>
    );
  }

  if (!diag) {
    return <div className="p-6 text-sm text-red-600">診断データを取得できませんでした</div>;
  }

  const c = diag.config;
  const allOk = c.access_token_set && c.access_token_valid === true && c.channel_secret_set;

  return (
    <div className="p-4 space-y-4">
      {/* 全体ステータス */}
      <div
        className={`rounded-2xl border p-4 ${
          allOk ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              allOk ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
            }`}
          >
            {allOk ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          </span>
          <div className="flex-1">
            <p className="font-medium">
              {allOk ? 'LINE 連携は正常に設定されています' : 'LINE 連携に問題があります'}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              受信イベント {diag.counts.total_events} 件 ・ 受信メッセージ {diag.counts.inbound_messages} 件
            </p>
          </div>
          <Button onClick={load} variant="ghost" size="sm" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            更新
          </Button>
        </div>
      </div>

      {/* 設定チェック */}
      <Card>
        <CardContent className="space-y-2">
          <p className="text-xs font-medium text-ink-500 mb-2">環境変数チェック</p>
          <CheckRow
            ok={c.access_token_set}
            label="LINE_CHANNEL_ACCESS_TOKEN"
            help="LINE Developers > Messaging API > Channel access token"
          />
          {c.access_token_set && (
            <CheckRow
              ok={c.access_token_valid === true}
              label="Access Token の有効性"
              error={c.access_token_error ?? undefined}
              help="LINE API でテスト呼び出しを実行"
            />
          )}
          <CheckRow
            ok={c.channel_secret_set}
            label="LINE_CHANNEL_SECRET"
            help="LINE Developers > Basic settings > Channel secret"
          />
          <CheckRow
            ok={!!c.app_url && !c.app_url.includes('未設定')}
            label="NEXT_PUBLIC_APP_URL"
            help={c.app_url}
          />
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardContent>
          <p className="text-xs font-medium text-ink-500 mb-2">
            LINE Developers の Webhook URL に登録すべき値
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-ink-50 px-3 py-2 text-xs font-mono">
              {c.webhook_url}
            </code>
            <CopyButton value={c.webhook_url} />
          </div>
          <ol className="mt-3 space-y-1 text-xs text-ink-500 list-decimal pl-5">
            <li>LINE Developers Console &gt; Messaging API タブ</li>
            <li>「Webhook URL」に上記をペースト + 「Update」を押す</li>
            <li>「Use webhook」を ON</li>
            <li>「Verify」をクリック → 200 が返れば OK</li>
          </ol>
        </CardContent>
      </Card>

      {/* ⚠️ 受信されない場合の最重要チェック */}
      {diag.counts.total_events === 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-medium text-amber-900">
                  受信イベントが 0 件 — 以下を必ず確認してください
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  設定値は正しくても、LINE 側のスイッチで受信が止まっているケースが大半です
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-white border border-amber-200 p-3">
                <p className="font-medium text-amber-900 mb-2">
                  ① LINE Official Account Manager の応答設定
                  <span className="ml-2 inline-flex items-center text-[10px] rounded-full bg-amber-200 text-amber-900 px-2 py-0.5">
                    最重要
                  </span>
                </p>
                <p className="text-xs text-ink-600 mb-2">
                  Developers Console とは<strong>別のサイト</strong>に応答機能の設定があります。
                  ここで Webhook が OFF だと永遠に届きません。
                </p>
                <a
                  href="https://manager.line.biz/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-vivie-600 hover:underline"
                >
                  <ExternalLink size={11} />
                  manager.line.biz を開く
                </a>
                <ol className="mt-2 space-y-0.5 text-xs text-ink-600 list-decimal pl-5">
                  <li>該当アカウントを選択</li>
                  <li>左メニュー「設定」&gt;「応答設定」</li>
                  <li>
                    <strong>応答モード</strong>: <code className="bg-ink-100 px-1 rounded">Bot</code>
                  </li>
                  <li>
                    <strong>あいさつメッセージ</strong>: お好みで (受信には影響なし)
                  </li>
                  <li>
                    <strong>応答メッセージ</strong>:{' '}
                    <code className="bg-red-50 text-red-700 px-1 rounded">オフ</code>
                  </li>
                  <li>
                    <strong>Webhook</strong>:{' '}
                    <code className="bg-emerald-50 text-emerald-700 px-1 rounded">オン</code>
                  </li>
                </ol>
              </div>

              <div className="rounded-xl bg-white border border-amber-200 p-3">
                <p className="font-medium text-amber-900 mb-2">② Verify ボタンを再度実行</p>
                <p className="text-xs text-ink-600">
                  LINE Developers Console &gt; Messaging API &gt; Webhook URL の右にある
                  「Verify」をクリック。**200** が返らない場合は URL が間違っています。
                </p>
              </div>

              <div className="rounded-xl bg-white border border-amber-200 p-3">
                <p className="font-medium text-amber-900 mb-2">③ テスト送信</p>
                <p className="text-xs text-ink-600 mb-2">
                  自分の LINE で公式アカウントに「テスト」と送信して、ここに表示されるか確認してください。
                  友だち追加が必要です (Developers Console &gt; Messaging API &gt; QR コードから追加)。
                </p>
                <Button onClick={runTestEvent} disabled={testing} variant="secondary" size="sm">
                  {testing ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                  DB 書き込みテスト (LINE を経由しない)
                </Button>
                <p className="mt-2 text-xs text-ink-500">
                  これでテストユーザーが表示されれば DB は正常 →
                  実 LINE のメッセージが届かないのは ① か ② の設定問題
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 直近イベント */}
      <Card>
        <CardContent>
          <p className="text-xs font-medium text-ink-500 mb-3">直近の Webhook イベント (最新 10 件)</p>
          {diag.recent_events.length === 0 ? (
            <div className="text-center py-6 text-xs text-ink-400">
              <MessageCircle size={28} className="mx-auto mb-2 text-ink-300" />
              <p>まだ Webhook が一度も呼ばれていません</p>
              <p className="mt-1">
                LINE Developers の Webhook URL 設定 + Verify が完了しているか確認してください
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {diag.recent_events.map((ev: any) => (
                <li
                  key={ev.id}
                  className="rounded-lg border border-ink-100 bg-ink-50/30 px-3 py-2 text-xs flex items-center gap-2"
                >
                  <Badge
                    tone={
                      ev.event_type === 'message'
                        ? 'green'
                        : ev.event_type === 'follow'
                          ? 'rose'
                          : ev.event_type === 'signature_failed'
                            ? 'red'
                            : 'default'
                    }
                  >
                    {ev.event_type}
                  </Badge>
                  <span className="text-ink-700 flex-1 truncate">
                    {ev.display_name && <strong>{ev.display_name} </strong>}
                    {ev.message_text}
                  </span>
                  <span className="text-ink-400">{formatDateTime(ev.received_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 直近メッセージ */}
      <Card>
        <CardContent>
          <p className="text-xs font-medium text-ink-500 mb-3">
            直近のメッセージ (line_messages テーブル / 最新 10 件)
          </p>
          {diag.recent_messages.length === 0 ? (
            <p className="text-center py-4 text-xs text-ink-400">まだメッセージがありません</p>
          ) : (
            <ul className="space-y-1.5">
              {diag.recent_messages.map((msg: any) => (
                <li
                  key={msg.id}
                  className="rounded-lg border border-ink-100 bg-ink-50/30 px-3 py-2 text-xs flex items-center gap-2"
                >
                  {msg.direction === 'inbound' ? (
                    <ArrowDown size={12} className="text-emerald-600" />
                  ) : (
                    <ArrowUp size={12} className="text-vivie-600" />
                  )}
                  <span className="text-ink-700 flex-1 truncate">{msg.message_text ?? '—'}</span>
                  <span className="text-ink-400">{formatDateTime(msg.sent_at)}</span>
                </li>
              ))}
            </ul>
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
  error,
}: {
  ok: boolean;
  label: string;
  help?: string;
  error?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full mt-0.5 ${
          ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      </span>
      <div className="flex-1 min-w-0">
        <p className={ok ? 'text-ink-900' : 'text-red-700 font-medium'}>{label}</p>
        {help && <p className="text-xs text-ink-500 break-all">{help}</p>}
        {error && <p className="text-xs text-red-600 break-all mt-0.5">{error}</p>}
      </div>
    </div>
  );
}
