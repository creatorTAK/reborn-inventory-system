/**
 * Firestoreに「全体」トークルームの初期データを作成
 *
 * 実行方法：
 * 1. Firebaseコンソールを開く
 * 2. Firestoreデータベースを選択
 * 3. 「コレクションを開始」をクリック
 * 4. 以下のJSONデータを手動で入力
 *
 * または、このファイルの内容をブラウザのコンソールで実行
 */

/**
 * 初期データ: 全体トークルーム
 *
 * Firestore コンソールで以下を作成：
 *
 * コレクション: rooms
 * ドキュメントID: room_all
 * フィールド:
 */

const initialRoomData = {
  roomId: 'room_all',
  name: '全体',
  type: 'all',
  icon: '📌',
  members: [],  // 全員参加なので空配列（または全ユーザー名の配列）
  createdBy: 'システム',
  createdAt: new Date(),
  lastMessage: 'トークルームが作成されました',
  lastMessageAt: new Date(),
  lastMessageBy: 'システム'
};

/**
 * Firestoreコンソールでの手動作成手順：
 *
 * 1. Firebaseコンソール → Firestore Database
 * 2. 「コレクションを開始」
 * 3. コレクションID: rooms
 * 4. ドキュメントID: room_all
 * 5. 以下のフィールドを追加：
 *
 * | フィールド名    | タイプ     | 値                                |
 * |----------------|-----------|-----------------------------------|
 * | roomId         | string    | room_all                         |
 * | name           | string    | 全体                              |
 * | type           | string    | all                              |
 * | icon           | string    | 📌                               |
 * | members        | array     | []                               |
 * | createdBy      | string    | システム                          |
 * | createdAt      | timestamp | （現在時刻）                      |
 * | lastMessage    | string    | トークルームが作成されました      |
 * | lastMessageAt  | timestamp | （現在時刻）                      |
 * | lastMessageBy  | string    | システム                          |
 *
 * 6. 「保存」をクリック
 */

/**
 * 既存のメッセージにroomIdを追加する方法：
 *
 * Firestoreコンソールで messages コレクションの各ドキュメントに以下を追加：
 *
 * | フィールド名 | タイプ  | 値       |
 * |-------------|--------|----------|
 * | roomId      | string | room_all |
 *
 * または、すべて削除して新規メッセージから始める
 */

console.log('初期データ:', JSON.stringify(initialRoomData, null, 2));
