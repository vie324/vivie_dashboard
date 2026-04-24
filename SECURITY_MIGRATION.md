# セキュリティ強化 (Phase 1) 移行手順

`index.html` 側のセキュリティ強化に伴い、Google Apps Script (GAS) 側にも以下の変更が必要です。
このドキュメントの手順を **本番反映前に必ず** 実施してください。

## 概要

| 変更点 | クライアント側 | GAS 側 |
|---|---|---|
| パスワード平文保存の廃止 | PBKDF2-SHA256 で `authKey` を生成して送信 | `pepper` 付き SHA-256 で照合・保存 |
| アクセストークンの署名 | GAS に署名/検証を委譲 | HMAC-SHA256(secret, payload) で署名・検証 |
| PII の localStorage 暗号化 | AES-GCM で透過暗号化 | (変更不要) |

---

## 0. 事前準備

### 既存スタッフへの周知 (必須)

セキュリティ強化により、**既存のログインURLとパスワードはすべて無効になります**。

- スタッフ全員に「URLとパスワードを再発行する」旨を事前連絡
- 移行作業のメンテナンス時間 (10〜30分程度) を案内
- パスワードは管理者が再設定し、新URLと共に各スタッフに個別連絡

---

## 1. PropertiesService にシークレットを設定

GAS エディタで以下のスクリプトを **一度だけ** 実行し、`pepper` (パスワードハッシュの追加塩) と `tokenSecret` (HMAC 署名鍵) を生成・保存します。

```javascript
function setupSecuritySecrets() {
  const props = PropertiesService.getScriptProperties();
  // 既に設定済みの場合は上書きしない
  if (props.getProperty('AUTH_PEPPER') && props.getProperty('TOKEN_SECRET')) {
    Logger.log('既に設定済みです');
    return;
  }
  // 32 byte のランダム文字列
  const randHex = (n) => {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
  };
  props.setProperty('AUTH_PEPPER', randHex(32));
  props.setProperty('TOKEN_SECRET', randHex(32));
  Logger.log('設定完了。これらの値は今後変更しないでください。');
}
```

**重要**:
- `AUTH_PEPPER` と `TOKEN_SECRET` は一度設定したら変更しない (変更すると全パスワード/全URLが無効になる)
- スプレッドシート本体ではなく PropertiesService に保管されるため、共同編集者からは見えない
- `crypto.getRandomValues` は GAS の V8 ランタイムで利用可能

---

## 2. スプレッドシートのスタッフシートに新カラムを追加

`スタッフ` シート (またはスタッフ管理用シート) に以下のカラムを追加します。
既存の `password` カラムは **空にしてもよい / そのままでも害はない** が、新ログイン時には参照されません。

| 既存カラム | 新規カラム |
|---|---|
| id, name, role, storeIds, status, createdAt, password | **passwordSalt**, **passwordAuthKey**, **passwordAlgo**, **passwordIter** |

順序は問いませんが、既存コードがカラム順に依存しないことを確認してください (ヘッダ行から動的にマッピングする実装ならOK)。

---

## 3. GAS スクリプトに以下のハンドラを追加

`doGet` / `doPost` のディスパッチに `type: 'auth'` と `type: 'authToken'` を追加します。

### 3-1. パスワード認証 (`type: 'auth'`)

```javascript
// ===== auth: パスワード認証 =====
function handleAuth(params, body) {
  const action = (body && body.action) || params.action;

  if (action === 'getSalt') {
    const staffId = (body && body.staffId) || params.staffId;
    const staff = findStaffById_(staffId);
    if (!staff) return jsonOut_({ ok: false, reason: 'スタッフが見つかりません' });
    // 旧形式の平文 password が残っていて、新形式の hash がない → リセット要
    if (staff.password && !staff.passwordAuthKey) {
      return jsonOut_({ ok: true, legacy: true });
    }
    if (!staff.passwordAuthKey) {
      // パスワード未設定: そのまま通過させる
      return jsonOut_({ ok: true, salt: '' });
    }
    return jsonOut_({ ok: true, salt: staff.passwordSalt });
  }

  if (action === 'verify') {
    const staffId = (body && body.staffId) || '';
    const authKey = (body && body.authKey) || '';
    const staff = findStaffById_(staffId);
    if (!staff || !staff.passwordAuthKey) {
      return jsonOut_({ ok: false, reason: 'パスワードが設定されていません' });
    }
    const pepper = PropertiesService.getScriptProperties().getProperty('AUTH_PEPPER') || '';
    const hashed = sha256Hex_(authKey + pepper);
    if (constantTimeEqual_(hashed, staff.passwordAuthKey)) {
      return jsonOut_({ ok: true });
    }
    Utilities.sleep(300); // タイミング攻撃緩和 + 簡易レート制限
    return jsonOut_({ ok: false, reason: 'パスワードが正しくありません' });
  }

  return jsonOut_({ ok: false, reason: '不明なaction' });
}
```

### 3-2. パスワード保存ロジックの変更

`updateStaff` / `saveStaff` ハンドラを修正し、新規にスタッフ情報を書き込む際:

- クライアントから送られてくる `passwordAuthKey` は、そのまま `pepper` を加えて SHA-256 → 16進文字列でカラム保存する
- `passwordSalt` / `passwordAlgo` / `passwordIter` はクライアントから受け取った値をそのまま保存
- 旧 `password` カラムには **絶対に値を書き込まない** (空にする)

```javascript
function applyPasswordPayloadToStaff_(row, payload) {
  if (!payload || !payload.passwordAuthKey) return;
  const pepper = PropertiesService.getScriptProperties().getProperty('AUTH_PEPPER') || '';
  row.passwordSalt    = payload.passwordSalt;
  row.passwordAuthKey = sha256Hex_(payload.passwordAuthKey + pepper);
  row.passwordAlgo    = payload.passwordAlgo || 'PBKDF2-SHA256';
  row.passwordIter    = payload.passwordIter || 210000;
  row.password        = ''; // 旧フィールドは必ず空に
}
```

`updateStaff` ハンドラ内で `applyPasswordPayloadToStaff_(updates, updates)` を呼び、シート書き込みに渡します。

### 3-3. トークン発行・検証 (`type: 'authToken'`)

```javascript
// ===== authToken: アクセストークンの発行・検証 =====
function handleAuthToken(params, body) {
  const action = body && body.action;
  const secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET') || '';
  if (!secret) return jsonOut_({ ok: false, reason: 'TOKEN_SECRET 未設定' });

  if (action === 'sign') {
    const staffId = body.staffId;
    const ttlDays = Math.max(1, Math.min(365, parseInt(body.ttlDays || 30, 10)));
    const staff = findStaffById_(staffId);
    if (!staff) return jsonOut_({ ok: false, reason: 'スタッフが見つかりません' });
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      n: staff.name,
      r: staff.role,
      sid: staff.storeIds || [],
      pw: staff.passwordAuthKey ? 1 : 0,
      id: staff.id,
      iat: now,
      exp: now + ttlDays * 86400,
    };
    const payloadB64 = b64UrlEncode_(JSON.stringify(payload));
    const sigB64 = b64UrlEncode_(hmacSha256Bytes_(secret, payloadB64));
    return jsonOut_({ ok: true, token: payloadB64 + '.' + sigB64 });
  }

  if (action === 'verify') {
    const token = body.token || '';
    const idx = token.indexOf('.');
    if (idx < 0) return jsonOut_({ ok: false, reason: 'malformed' });
    const payloadB64 = token.slice(0, idx);
    const sigB64 = token.slice(idx + 1);
    const expected = b64UrlEncode_(hmacSha256Bytes_(secret, payloadB64));
    if (!constantTimeEqual_(expected, sigB64)) {
      return jsonOut_({ ok: false, reason: 'signature' });
    }
    let payload;
    try { payload = JSON.parse(b64UrlDecodeStr_(payloadB64)); }
    catch (e) { return jsonOut_({ ok: false, reason: 'malformed' }); }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp + 300 < now) {
      return jsonOut_({ ok: false, reason: 'expired' });
    }
    // 念のため最新のスタッフ状態とつき合わせる (退職者をブロック)
    const staff = findStaffById_(payload.id);
    if (!staff || staff.status === 'inactive') {
      return jsonOut_({ ok: false, reason: 'スタッフが無効です' });
    }
    return jsonOut_({ ok: true, payload });
  }

  return jsonOut_({ ok: false, reason: '不明なaction' });
}
```

### 3-4. ユーティリティ

```javascript
function sha256Hex_(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

function hmacSha256Bytes_(secret, message) {
  return Utilities.computeHmacSha256Signature(message, secret, Utilities.Charset.UTF_8);
}

function b64UrlEncode_(input) {
  // input は文字列または byte 配列
  const b64 = (typeof input === 'string')
    ? Utilities.base64Encode(input, Utilities.Charset.UTF_8)
    : Utilities.base64Encode(input);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlDecodeStr_(s) {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Utilities.newBlob(Utilities.base64Decode(b64)).getDataAsString('UTF-8');
}

function constantTimeEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function findStaffById_(id) {
  // 既存実装に合わせてシートからスタッフ行を返す
  // 例: const sheet = SpreadsheetApp.getActive().getSheetByName('staff');
  //     const rows = readRows_(sheet);
  //     return rows.find(r => r.id === id);
  // 実装は既存の updateStaff / saveStaff と揃えてください
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 3-5. ディスパッチに登録

`doPost(e)` (および必要なら `doGet(e)`) のディスパッチ:

```javascript
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  switch (body.type) {
    case 'auth':      return handleAuth({}, body);
    case 'authToken': return handleAuthToken({}, body);
    // ...既存のtype...
  }
}
```

---

## 4. 旧データのクリア (任意・推奨)

セキュリティ強化後、以下のクリーンアップを推奨します。

### スタッフシート

- 全スタッフ行の `password` カラムを空にする
- `passwordAuthKey` 等が未設定のスタッフは **次回ログイン時に「再設定が必要」エラー** になる
- 管理者がダッシュボードの設定画面 → スタッフ編集 → パスワード入力 → 保存することで再設定

### URL の再発行

- ダッシュボードの「設定 → スタッフ → URLボタン」が GAS 経由の署名付きトークンを発行するように変更済み
- 各スタッフに新URLを再共有

---

## 5. デプロイ手順

1. Apps Script エディタで上記コードを反映
2. 「デプロイ → デプロイを管理 → 鉛筆アイコン → バージョン: 新しいバージョン → デプロイ」
3. URL は変わりません
4. ダッシュボードをリロードし、設定 → スタッフでテストユーザーを 1 名作成
5. 発行された URL でログイン → パスワード入力 → ダッシュボード表示まで動作確認
6. 既存スタッフのパスワードを管理者が順次再発行

---

## 6. ロールバック手順 (緊急時のみ)

万一問題が発生した場合:

1. `index.html` を以前のコミット (このセキュリティ強化PR の直前) に巻き戻す
2. GAS 側のスタッフシートで旧 `password` カラムが残っていれば、旧 URL でログイン可能
3. ただし旧形式は平文保存のため、できるだけ早く前進方向で問題解消を推奨

---

## 7. 残課題 (Phase 2 以降)

このフェーズでは扱わない項目:

- **Vercel API プロキシの CSRF トークン検証**
- **Square API キーのローテーション周期管理**
- **GAS 側のレート制限 (連続パスワード試行ブロック)**
- **管理者パスワードと一般スタッフパスワードの分離**
- **多要素認証 (MFA)** — TOTP / WebAuthn の導入
- **監査ログ** — 「誰が誰のデータを閲覧/編集したか」の記録
