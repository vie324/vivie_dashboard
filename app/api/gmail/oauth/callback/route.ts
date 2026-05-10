import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { GmailClient } from '@/lib/gmail/client';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/settings/gmail?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${baseUrl}/settings/gmail?error=no_code`);
  }

  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user || user.id !== state) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  // code を refresh_token に交換
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: `${baseUrl}/api/gmail/oauth/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    return NextResponse.redirect(
      `${baseUrl}/settings/gmail?error=${encodeURIComponent('token_exchange:' + txt.slice(0, 100))}`,
    );
  }
  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  if (!tokenData.refresh_token) {
    return NextResponse.redirect(
      `${baseUrl}/settings/gmail?error=no_refresh_token`,
    );
  }

  // プロフィール取得 (emailAddress + historyId)
  const client = new GmailClient(tokenData.refresh_token);
  let profile;
  try {
    profile = await client.getProfile();
  } catch (err) {
    return NextResponse.redirect(
      `${baseUrl}/settings/gmail?error=${encodeURIComponent(String(err).slice(0, 100))}`,
    );
  }

  const supabase = createServiceClient();
  await supabase.from('gmail_integration_settings').upsert(
    {
      id: 'default',
      email_address: profile.emailAddress,
      refresh_token: tokenData.refresh_token,
      history_id: profile.historyId,
      is_active: false, // 後で watch 開始
      connected_by: user.id,
      connected_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: 'id' },
  );

  return NextResponse.redirect(`${baseUrl}/settings/gmail?ok=1`);
}
