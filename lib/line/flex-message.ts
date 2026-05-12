// 初回未契約フォローアップ用 Flex Message ビルダー
// LINE で「本日の成果 + あと 1 回だけお得に来店できる」を送る

import { SKIN_AXES, FACE_AXES, avgScore } from '@/lib/treatment-axes';

export interface FollowupOffer {
  menu?: string | null;
  original_price?: number | null;
  discounted_price?: number | null;
  discount_label?: string | null;
  expires_at?: string | null;
  reservation_url?: string | null;
  notes?: string | null;
}

interface BuildArgs {
  customerName: string;
  storeName: string;
  treatmentDate: string;
  skinScores: Record<string, number>;
  faceScores: Record<string, number>;
  observations?: string | null;
  offer: FollowupOffer;
  greeting?: string;
}

function fmtYen(n: number | null | undefined) {
  if (!n) return '';
  return `¥${n.toLocaleString('ja-JP')}`;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getMonth() + 1}月${d.getDate()}日まで`;
}

export function buildFollowupFlex(args: BuildArgs) {
  const skin = avgScore(SKIN_AXES, args.skinScores);
  const face = avgScore(FACE_AXES, args.faceScores);
  const offer = args.offer;
  const reservationUrl = offer.reservation_url || 'https://line.me';

  const altText = `${args.customerName}様、本日の施術ありがとうございました。特別オファーがあります。`;

  const bodyContents: any[] = [
    {
      type: 'text',
      text: `${args.customerName} 様`,
      weight: 'bold',
      size: 'md',
      color: '#955351',
    },
    {
      type: 'text',
      text: args.greeting ?? '本日はご来店ありがとうございました 🌸',
      size: 'sm',
      color: '#6B6359',
      wrap: true,
      margin: 'sm',
    },
  ];

  // スコア表示
  if (skin > 0 || face > 0) {
    bodyContents.push(
      {
        type: 'separator',
        margin: 'lg',
      },
      {
        type: 'text',
        text: '✨ 本日の施術評価',
        weight: 'bold',
        size: 'sm',
        margin: 'lg',
        color: '#3F3A33',
      },
      {
        type: 'box',
        layout: 'horizontal',
        margin: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            flex: 1,
            contents: [
              { type: 'text', text: '肌', size: 'xxs', color: '#888888' },
              {
                type: 'text',
                text: `${skin}/5`,
                size: 'xl',
                weight: 'bold',
                color: '#C98785',
              },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            flex: 1,
            contents: [
              { type: 'text', text: '顔', size: 'xxs', color: '#888888' },
              {
                type: 'text',
                text: `${face}/5`,
                size: 'xl',
                weight: 'bold',
                color: '#C98785',
              },
            ],
          },
        ],
      },
    );
  }

  // 観察 / コメント
  if (args.observations) {
    bodyContents.push(
      {
        type: 'separator',
        margin: 'lg',
      },
      {
        type: 'text',
        text: '担当からのコメント',
        weight: 'bold',
        size: 'sm',
        margin: 'lg',
        color: '#3F3A33',
      },
      {
        type: 'text',
        text: args.observations,
        size: 'sm',
        wrap: true,
        margin: 'sm',
        color: '#6B6359',
      },
    );
  }

  // オファー
  bodyContents.push(
    {
      type: 'separator',
      margin: 'xl',
    },
    {
      type: 'box',
      layout: 'vertical',
      margin: 'lg',
      backgroundColor: '#FBF4F4',
      cornerRadius: 'md',
      paddingAll: '14px',
      contents: [
        {
          type: 'text',
          text: '🎁 あなただけの特別オファー',
          weight: 'bold',
          size: 'sm',
          color: '#955351',
        },
        ...(offer.menu
          ? [
              {
                type: 'text',
                text: offer.menu,
                size: 'md',
                weight: 'bold',
                margin: 'sm',
                color: '#3F3A33',
              },
            ]
          : []),
        ...(offer.original_price && offer.discounted_price
          ? [
              {
                type: 'box',
                layout: 'baseline',
                margin: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: fmtYen(offer.original_price),
                    size: 'xs',
                    color: '#AAAAAA',
                    decoration: 'line-through',
                    flex: 0,
                  },
                  {
                    type: 'text',
                    text: ` → ${fmtYen(offer.discounted_price)}`,
                    size: 'lg',
                    weight: 'bold',
                    color: '#C98785',
                    margin: 'sm',
                    flex: 0,
                  },
                ],
              },
            ]
          : []),
        ...(offer.discount_label
          ? [
              {
                type: 'text',
                text: offer.discount_label,
                size: 'sm',
                color: '#955351',
                weight: 'bold',
                margin: 'xs',
              },
            ]
          : []),
        ...(offer.expires_at
          ? [
              {
                type: 'text',
                text: `⏰ ${fmtDate(offer.expires_at)}`,
                size: 'xs',
                color: '#888888',
                margin: 'sm',
              },
            ]
          : []),
        ...(offer.notes
          ? [
              {
                type: 'text',
                text: offer.notes,
                size: 'xxs',
                color: '#888888',
                wrap: true,
                margin: 'sm',
              },
            ]
          : []),
      ],
    },
  );

  return {
    type: 'flex',
    altText,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#DCA9A8',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: 'vivie',
            weight: 'bold',
            color: '#FFFFFF',
            size: 'lg',
          },
          {
            type: 'text',
            text: `${args.storeName} ・ ${args.treatmentDate}`,
            color: '#FFFFFF',
            size: 'xxs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents,
        spacing: 'sm',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#C98785',
            action: {
              type: 'uri',
              label: 'いますぐ予約する',
              uri: reservationUrl,
            },
          },
        ],
      },
    },
  };
}
