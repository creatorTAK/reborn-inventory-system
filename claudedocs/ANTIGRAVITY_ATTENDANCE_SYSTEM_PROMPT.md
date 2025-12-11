# Google Antigravity用 設計書
# ナイトワーク勤怠管理システム

---

## プロジェクト概要

スナック・ラウンジ等のナイトワーク店舗向け勤怠管理システムを開発してください。

**特徴**:
- GPS打刻による不正防止
- ナイトワーク特有の給与計算（ドリンクバック、指名バック等）
- キャストが自分のスマホで実績・給与を確認できる
- 店舗オーナー（ママ）がシフト・給与を管理できる

---

## 技術スタック

- **フロントエンド**: PWA（Progressive Web App）
- **バックエンド**: Firebase
  - Firestore（データベース）
  - Firebase Authentication（認証）
  - Cloud Functions（バックエンド処理）
  - FCM（プッシュ通知）
- **地図/位置情報**: Web Geolocation API
- **言語**: HTML, CSS, JavaScript（フレームワークなし）

---

## ユーザー種別と権限

| ユーザー | ログイン方法 | できること |
|----------|-------------|-----------|
| **オーナー/ママ** | メールアドレス | 全機能（設定、キャスト管理、給与確定、シフト管理） |
| **キャスト** | メールアドレス | 打刻、自分の勤怠確認、給与明細確認、シフト希望提出 |

---

## Firestoreデータ構造

```javascript
// 店舗情報
shops/{shopId}: {
  name: string,              // "スナック〇〇"
  location: {
    lat: number,             // 緯度
    lng: number              // 経度
  },
  radius: number,            // 打刻可能範囲（メートル）デフォルト50
  settings: {
    hourlyRateDefault: number,    // デフォルト時給
    drinkBackRate: number,        // ドリンクバック単価（円/杯）
    nominationBackRate: number,   // 指名バック単価（円/回）
    companionBackRate: number,    // 同伴バック単価（円/回）
    bottleBackPercent: number,    // ボトルバック率（%）
    withholdingTaxRate: number    // 源泉徴収率（デフォルト10.21%）
  },
  createdAt: timestamp,
  updatedAt: timestamp
}

// ユーザー情報
users/{userId}: {
  email: string,
  name: string,
  role: "owner" | "cast",
  shopId: string,            // 所属店舗
  hourlyRate: number,        // 個人時給（オーナーが設定）
  birthday: date,
  profileImage: string,      // URL
  status: "active" | "inactive",
  createdAt: timestamp
}

// 勤怠記録
attendance/{recordId}: {
  oderId
  oderId
  shopId: string,
  date: string,              // "2025-01-15"
  clockIn: timestamp,
  clockOut: timestamp | null,
  clockInLocation: {lat, lng},
  clockOutLocation: {lat, lng} | null,
  workMinutes: number,       // 労働時間（分）
  drinks: number,            // ドリンク杯数
  nominations: number,       // 指名回数
  companions: number,        // 同伴回数
  bottleSales: number,       // ボトル売上（円）
  memo: string,
  status: "working" | "completed",
  createdAt: timestamp,
  updatedAt: timestamp
}

// シフト
shifts/{shiftId}: {
  shopId: string,
  date: string,              // "2025-01-15"
  assignments: [
    {
      userId: string,
      startTime: string,     // "20:00"
      endTime: string,       // "02:00"
      status: "confirmed" | "requested" | "cancelled"
    }
  ],
  createdAt: timestamp,
  updatedAt: timestamp
}

// 給与データ（月次）
payrolls/{payrollId}: {
  userId: string,
  oderId
  month: string,             // "2025-01"
  breakdown: {
    workHours: number,
    hourlyPay: number,       // 時給分
    drinkBack: number,
    nominationBack: number,
    companionBack: number,
    bottleBack: number,
    grossTotal: number,      // 総支給額
    withholdingTax: number,  // 源泉徴収額
    advancePayment: number,  // 日払い済み額
    netTotal: number         // 差引支給額
  },
  status: "draft" | "confirmed" | "paid",
  createdAt: timestamp,
  confirmedAt: timestamp | null,
  paidAt: timestamp | null
}
```

---

## 画面一覧と機能

### 1. ログイン画面
- メールアドレス + パスワードでログイン
- Firebase Authentication使用
- 新規登録リンク

### 2. キャスト向け画面

#### 2-1. ホーム画面（キャスト）
```
┌─────────────────────────────────────┐
│  👤 さくら さん                     │
│  スナック〇〇                        │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │  [出勤する]  または [退勤する] │   │
│  └─────────────────────────────┘   │
│                                     │
│  📊 今月の実績                      │
│  ├─ 出勤日数: 12日                 │
│  ├─ 労働時間: 72時間               │
│  ├─ ドリンク: 98杯                 │
│  └─ 指名: 15回                     │
│                                     │
│  💰 今月の見込み給与                │
│  └─ 約 185,000円                   │
│                                     │
├─────────────────────────────────────┤
│  [ホーム] [勤怠] [給与] [シフト]    │
└─────────────────────────────────────┘
```

#### 2-2. 打刻機能
- 「出勤する」ボタンタップ
- GPS位置を取得
- 店舗から50m以内かチェック
- 範囲外なら「店舗の近くで打刻してください」エラー
- 範囲内なら打刻成功、Firestoreに記録
- 退勤も同様の流れ

#### 2-3. 勤怠履歴画面
- 今月の出退勤一覧
- 日付、出勤時間、退勤時間、労働時間
- ドリンク数、指名数（オーナーが入力したもの）

#### 2-4. 給与明細画面
- 月別の給与明細一覧
- 明細詳細（時給分、各種バック、源泉徴収、日払い分、差引支給額）

#### 2-5. シフト画面
- カレンダー表示
- 自分のシフト確認
- シフト希望の提出（日付選択 → 希望時間入力）

### 3. オーナー向け画面

#### 3-1. ホーム画面（オーナー）
```
┌─────────────────────────────────────┐
│  🏠 スナック〇〇 管理画面           │
├─────────────────────────────────────┤
│                                     │
│  📅 今日の出勤                      │
│  ├─ さくら (20:00〜)               │
│  ├─ れいな (21:00〜)               │
│  └─ ゆうか (20:00〜)               │
│                                     │
│  📊 今月の概要                      │
│  ├─ 総労働時間: 420時間            │
│  ├─ 総ドリンク: 580杯              │
│  └─ 給与総額: 約 850,000円         │
│                                     │
├─────────────────────────────────────┤
│ [ホーム][キャスト][勤怠][シフト][設定]│
└─────────────────────────────────────┘
```

#### 3-2. キャスト管理画面
- キャスト一覧
- 新規キャスト追加（招待メール送信）
- キャスト編集（時給設定等）
- キャスト削除（退店処理）

#### 3-3. 勤怠管理画面
- 日別の全キャスト勤怠一覧
- ドリンク数・指名数・同伴数・ボトル売上の入力
- 勤怠の修正機能

#### 3-4. シフト管理画面
- カレンダー形式でシフト表示
- キャストのシフト希望確認
- シフト割り当て・確定

#### 3-5. 給与管理画面
- 月別給与一覧
- キャスト別給与明細
- 日払い記録
- 給与確定処理

#### 3-6. 設定画面
- 店舗情報編集
- GPS位置設定（地図で選択）
- 各種バック単価設定
- 源泉徴収率設定

---

## MVP（最小実装）優先順位

### Phase 1（最優先）
1. ログイン/認証機能
2. GPS打刻機能（出勤・退勤）
3. 勤怠履歴表示（キャスト向け）
4. 勤怠管理（オーナー向け）

### Phase 2
5. 給与計算機能
6. 給与明細表示

### Phase 3
7. シフト管理
8. キャスト管理

---

## UI/UXガイドライン

- **モバイルファースト**: スマホでの操作を最優先
- **シンプルなUI**: ナイトワークの現場で片手で操作できる
- **ダークモード**: 暗い店内でも見やすい配色
- **大きなボタン**: 打刻ボタンは特に大きく、押しやすく

### カラーパレット（提案）
- プライマリ: #6C5CE7（パープル系）
- セカンダリ: #FD79A8（ピンク系）
- 背景（ダーク）: #2D3436
- テキスト: #FFFFFF

---

## 補足情報

### ナイトワーク業界の給与計算ルール

1. **時給**: 2,000〜3,000円が相場
2. **ドリンクバック**: お客様が注文したドリンク1杯につき300〜500円
3. **指名バック**: お客様からの指名1回につき1,000〜2,000円
4. **同伴バック**: 開店前に一緒に食事等してから来店で2,000〜3,000円
5. **ボトルバック**: ボトルキープ売上の10〜20%
6. **源泉徴収**: 個人事業主扱いで10.21%
7. **日払い/週払い**: 前払いした分は月末給与から差し引き

### GPS打刻の不正防止

- 打刻時に必ず位置情報を記録
- 店舗位置から一定距離以内（デフォルト50m）でのみ打刻可能
- GPS偽装アプリ対策として、位置情報の精度もチェック推奨

---

## 開発指示

1. まずPhase 1の機能を実装してください
2. Firebase プロジェクトのセットアップから開始
3. PWAとして動作するようにmanifest.jsonとService Workerを設定
4. レスポンシブデザインでモバイル優先
5. 日本語UIで開発

---

**このドキュメントを元に、勤怠管理システムのMVPを開発してください。**
