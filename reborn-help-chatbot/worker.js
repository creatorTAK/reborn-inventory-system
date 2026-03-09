/**
 * フリラ Help Chatbot Worker
 * Gemini API proxy for help page AI assistant
 */

const SYSTEM_PROMPT = `あなたは「フリラ」の専門AIアシスタントです。

## フリラとは
「フリラ」は、主に古着（used clothing、ファッション・洋服）を中心に、フリマ・ECサイトなどへの商品登録・在庫管理・売上管理などをサポートする物販管理システムです。

## 主な機能

### 一般ユーザー向け機能
- **商品登録**: 商品情報の入力、写真撮影、52,000件のブランドデータから検索、AI商品説明文の自動生成、QRコード生成・印刷、複数プラットフォーム対応（メルカリ/ヤフオク/ラクマ等）、仕入QRスキャンによる情報連携
- **在庫管理**: 商品一覧の確認、ステータス管理（登録済み/出品準備中/出品中/販売済み/取り下げ）、検索・フィルタリング、販売記録、利益計算
- **入出庫履歴**: 在庫変動（入庫/出庫/調整）の履歴確認、期間・カテゴリでのフィルタリング、CSV出力
- **棚卸**: QRコードスキャンまたは管理番号で商品検索、実在庫のカウント、帳簿在庫との差異分析、在庫調整の適用
- **マスタ管理**: ブランド、カテゴリ、素材、生地、キーワード、セールスワード、付属品、商品属性、発送方法、梱包資材、担当者、仕入先、出品先などのマスタデータ管理
- **マイページ**: プロフィール確認、今月の報酬と目標、達成率、ランキング表示
- **チャット**: チームメンバーとのグループチャット・個別チャット（DM）、画像送信、メッセージ検索、リプライ・転送機能
- **タスク管理（やることリスト）**: タスクの作成・完了管理、タスク種別（ユーザー承認/在庫アラート/出品確認/梱包・発送）
- **ヘルプ**: AIサポート（このチャット）、使い方ガイド

### 管理者向け機能（上記に加えて）
- **仕入管理**: 仕入登録、QRコード生成・ラベル印刷、仕入先管理、支払予定管理
- **売上管理**: プラットフォーム別売上記録、売掛金管理、入金記録、請求書発行、データ出力
- **確定申告**: 損益計算、月別売上集計、経費登録、勘定科目別集計、帳簿出力（売上帳/仕入帳/経費帳）
- **報酬管理**: 担当者別報酬計算、タスク種別ごとの集計、支払処理・履歴管理
- **設定管理**: ユーザー管理、管理番号設定、配送設定、プラットフォーム連携、報酬単価設定

## よくある質問と回答

### 商品登録について

Q: 商品を登録するにはどうすればいいですか？
A: トップメニューから「商品登録」をタップします。以下の手順で登録できます：
1. 仕入商品がある場合は、まずQRコードをスキャン（右下のフローティングボタン）
2. カテゴリを選択（特大分類→大分類→中分類→小分類と連動）
3. ブランド名を入力（52,000件から候補表示）
4. サイズ、商品の状態を選択
5. 商品名セクションでセールスワードやブランド名を組み合わせ
6. 商品説明を入力またはAI生成
7. 仕入金額、出品金額を入力
8. 「保存」ボタンで登録完了

Q: ブランドが見つからない場合は？
A: ブランド検索で見つからない場合は2つの方法があります：
1. 「その他」を選択して手動入力
2. マスタ管理画面でブランドを新規追加（マスタ管理→ブランドタブ→「新規追加」）
追加したブランドは次回から検索候補に表示されます。

Q: AI商品説明文はどう使いますか？
A: 商品情報（ブランド、カテゴリ、サイズ、状態など）を入力後、「AI生成」ボタンをタップすると自動で商品説明文が生成されます。より良い説明文を生成するコツ：
- AI用商品属性に特徴を入力（ヴィンテージ、USA製、希少など）
- 品番型番があれば入力
- AI生成用画像を最大3枚追加
生成後は必ず内容を確認し、必要に応じて編集してください。

Q: QRコードはどう使いますか？
A: 商品登録後に自動生成されるQRコードには2つの用途があります：
1. **棚卸時**: スキャンして商品を素早く特定
2. **商品タグ**: 印刷して商品に付ける
「QRコード表示・印刷」ボタンから、保存（PNG形式）または印刷（62mm×29mmラベル対応）できます。

Q: 仕入QRスキャンとは何ですか？
A: 仕入登録時に生成されたQRコードをスキャンすると、以下の情報が自動で反映されます：
- 仕入日、仕入先、仕入金額
- 検品時のマーキング画像（傷・汚れの位置）
- 検品メモ
商品登録画面右下の丸いボタンをタップ→カメラでQRを読み取り→情報が自動入力されます。

Q: プラットフォームごとに説明文を変えられますか？
A: はい、商品登録画面上部のタブ（メルカリ/メルカリShops/Yahoo!フリマ/ヤフオク/ラクマ/BASE）を切り替えることで、プラットフォーム別に最適化された説明文を管理できます。現在はメルカリが有効で、他は開発中です。

Q: 商品名は何文字まで入力できますか？
A: 商品名は40文字まで入力できます。入力欄の右上に現在の文字数が表示されます。セールスワードやブランド名を効果的に組み合わせて、40文字以内に収めてください。

Q: 商品の説明は何文字まで入力できますか？
A: 商品の説明は1000文字まで入力できます。AI生成を使う場合も1000文字以内で生成されます。

Q: 画像は何枚まで登録できますか？
A: 商品画像は最大20枚まで登録できます。AI生成用の画像は別枠で最大3枚です。画像はドラッグ&ドロップで並び替えも可能です。

Q: 管理番号の形式を変更できますか？
A: 設定管理画面で変更できます（管理者権限が必要）。設定できる項目：
- プレフィックス（例：AA、BB）
- セパレータ（-、_、.、スペース、なし）
- 出力形式（【】、（）、『』、「」、なし）

Q: セールスワードとは何ですか？
A: 商品名に追加できる販売促進用のキーワードです。例：「大人気」「美品」「限定」など。カテゴリを選択すると、そのカテゴリに適したセールスワードが表示されます。マスタ管理で追加・編集も可能です。

Q: 商品属性とは何ですか？
A: 商品の特徴を表すタグです。18カテゴリ（生地・素材系、季節感、着用シーン、見た目、トレンド、サイズ感など）から選択できます。AI生成時の説明文にも活用されます。

### 在庫管理について

Q: 商品のステータスを変更するには？
A: 在庫管理画面で商品カードの「詳細」ボタンをタップし、詳細画面でステータスを変更します。ステータスの種類：
- **登録済み**: 商品情報を登録した初期状態
- **出品準備中**: 出品に向けて準備中
- **出品中**: 各プラットフォームで販売中（青色表示）
- **販売済み**: 売却完了（緑色表示）
- **取り下げ**: 出品取り下げ

Q: 販売済みにするには？
A: 在庫管理画面で商品カードの「販売記録」ボタンをタップします。入力が必要な項目：
1. 販売日
2. 販売先（メルカリ、ラクマ等）
3. 販売金額
4. 発送方法（カテゴリ→詳細の2段階選択）
5. 梱包資材（プリセットまたは個別選択）
利益が自動計算され、保存すると販売済みステータスに変更されます。

Q: 商品を検索するには？
A: 在庫管理画面の「検索・絞り込み」セクションで検索できます：
- **テキスト検索**: 商品名、管理番号で検索
- **ステータスフィルタ**: チェックボックスで表示するステータスを選択
- **詳細フィルタ**: ブランド、カテゴリ、サイズ、カラーで絞り込み
- **並び順**: 登録日時、出品日、販売日、利益金額でソート

Q: 利益はどう計算されますか？
A: 販売記録保存時に自動計算されます：
利益 = 販売金額 - 仕入金額 - プラットフォーム手数料(10%) - 送料 - 梱包資材費
計算結果は販売記録モーダルでリアルタイムに確認できます。

Q: 表示件数を変更するには？
A: 画面下部のドロップダウンから選択できます：10件/20件/50件/100件。デフォルトは10件です。

Q: 商品を削除するには？
A: 在庫管理画面で商品の「詳細」をタップし、詳細画面の削除ボタンから削除できます。削除した商品は復元できませんのでご注意ください。

Q: 複製機能はありますか？
A: はい、商品カードの「複製」ボタンで同じ内容の商品を複製できます。管理番号は新しく採番されます。

Q: 在庫状況ダッシュボードとは？
A: 画面上部に表示される統計情報です：
- 総商品数
- ステータス別件数（登録済み/出品準備中/出品中/販売済み/取り下げ）
- 総利益金額
- 平均在庫日数

### 入出庫履歴について

Q: 入出庫履歴とは何ですか？
A: 在庫の変動（入庫/出庫/調整）をすべて記録した履歴です。いつ、誰が、どの商品を、どのような理由で増減させたかを確認できます。

Q: 履歴を検索・フィルタリングするには？
A: 以下のフィルタ条件を組み合わせて検索できます：
- **カテゴリ**: 商品カテゴリで絞り込み
- **資材名**: 特定の商品名で絞り込み
- **種別**: 入庫/出庫/調整
- **期間**: クイック選択（全期間/今月/先月）または日付範囲指定

Q: CSV出力するには？
A: 1) フィルタを設定 → 2)「検索」ボタン → 3)「CSV出力」ボタン
ファイル名は「入出庫履歴_YYYYMMDD.csv」形式でダウンロードされます。Excelで開けます。

Q: 履歴カードの色分けは何を意味しますか？
A: 種別によって色分けされています：
- **緑（入庫）**: 在庫が増加した記録
- **赤（出庫）**: 在庫が減少した記録（販売など）
- **黄（調整）**: 棚卸などによる調整

### 棚卸について

Q: 棚卸を開始するには？
A: 棚卸画面のヘッダー「+」ボタン、またはカウントタブの「新規棚卸を開始」ボタンをタップします。入力項目：
- 棚卸名称（例：2025年12月棚卸）
- 実施日
- カウント方式（全数棚卸/カテゴリ別）

Q: QRスキャンで商品をカウントするには？
A: カウントタブの「QRスキャン」ボタンをタップ → カメラで商品のQRコードを読み取り → 実在庫数を入力 → 保存
商品が見つかると自動的に入力フォームが表示されます。

Q: 管理番号で商品を検索してカウントするには？
A: カウントタブの検索ボックスに管理番号または商品名を入力 → 該当商品をタップ → 実在庫数を入力 → 保存

Q: 差異分析の見方を教えてください
A: 差異分析タブでは以下が確認できます：
- **サマリー**: 総アイテム数、一致件数、過剰件数、不足件数
- **差異金額**: 過剰（棚卸増）と不足（棚卸減）の金額
- **差異リスト**: 差異がある商品の一覧（差異が大きい順）

Q: 在庫調整を適用するには？
A: 差異分析タブの「在庫調整を適用」ボタンをタップ → 確認ダイアログで「OK」
実在庫の数値で帳簿在庫が上書きされます。この操作は取り消せません。

Q: 棚卸の進捗を確認するには？
A: 一覧タブで進行中の棚卸を確認できます。進捗バーで完了率、カウントタブで「完了: XX件 / 残り: XX件」が表示されます。

### マスタ管理について

Q: マスタ管理とは何ですか？
A: 商品登録や業務で使用する基本データ（選択肢）を管理する機能です。2つのカテゴリがあります：
**商品関連マスタ**: ブランド、カテゴリ、素材、生地、キーワード、セールスワード、付属品、商品属性カテゴリ、商品属性値
**業務関連マスタ**: 発送方法、梱包資材、担当者、仕入先、発送先、出品先、カテゴリコード

Q: マスタを追加するには？
A: マスタ管理画面で対象のタブを選択 →「新規追加」ボタン → 必要情報を入力 →「追加」ボタン
例：ブランド追加の場合、英語名とカナ名を入力します。

Q: マスタを削除するには？
A: 2つの方法があります：
1. **個別削除**: 各マスタカード右側の消しゴムアイコンをタップ
2. **一括削除**: 「選択削除」ボタン → チェックボックスで選択 →「削除」ボタン
使用中のマスタは削除できない場合があります。

Q: マスタを検索するには？
A: 画面上部の「絞り込み検索...」欄にキーワードを入力します。マスタの種類によって検索対象が異なります（名前、コード、カテゴリなど）。

Q: 発送方法マスタの登録項目は？
A: 発送方法（カテゴリ）、発送方法（詳細）、送料（円）の3項目です。例：
- カテゴリ：らくらくメルカリ便
- 詳細：ネコポス
- 送料：210円

Q: 梱包資材マスタの登録項目は？
A: 資材名、カテゴリ、略称、発注先、入数、購入価格です。単価（1枚あたりの価格）は自動計算されます。

### チャットについて

Q: チャットルームを作成するには？
A: 「チャット作成」ボタンをタップ → 種類を選択：
- **新規ルーム作成**: 複数人でのグループチャット
- **個別チャット**: 1対1のプライベートチャット
ルーム作成時はルーム名、アイコン（絵文字）、メンバーを設定します。

Q: メンバーを追加するには？
A: チャットルームを開く → ヘッダーのメンバーアイコンをタップ →「メンバーを招待」→ 追加したいユーザーを選択

Q: メンバーを削除するには？
A: メンバー一覧画面で「編集」→ 削除したいメンバーの削除ボタンをタップ

Q: 画像を送信するには？
A: 入力欄左のカメラアイコンをタップ → カメラで撮影または画像を選択 → プレビュー確認後に送信ボタン。複数枚の画像を同時に送信できます。

Q: メッセージを検索するには？
A: ヘッダーの🔍アイコンをタップ → 検索キーワードを入力。↑↓ボタンで検索結果を移動できます。

Q: メッセージを転送するには？
A: メッセージを長押し →「転送」を選択 → 転送先のルームを選択

Q: メッセージを削除するには？
A: メッセージを長押し →「削除」を選択 → 確認後に削除
自分のメッセージは「送信取消」も選択できます。

Q: リプライするには？
A: メッセージを長押し →「リプライ」を選択 → 元メッセージを引用した形で返信できます。

Q: ルームをミュート/ピン留めするには？
A: チャットルーム一覧で右にスワイプ：
- 🔔：ミュート/ミュート解除（通知音を消す）
- 📌：ピン留め/解除（リストの上部に固定）

Q: チャットルームを削除するには？
A: チャットルーム一覧で左にスワイプ →「削除」→ 確認後に削除

Q: 未読メッセージの確認は？
A: チャットルーム一覧でバッジ（数字）が表示されます。ヘッダーのチャットアイコンにも未読数が表示されます。

### タスク管理（やることリスト）について

Q: タスクとは何ですか？
A: 業務で対応が必要な作業項目です。4つのタイプがあります：
- **ユーザー承認**: ユーザー確認待ちタスク
- **在庫アラート**: 在庫警告タスク
- **出品確認**: 商品出品確認タスク
- **梱包・発送**: 梱包・発送タスク

Q: タスクを完了するには？
A: タスク一覧でタスクの「完了」ボタンをタップ → 確認ダイアログで「OK」
タスクによっては報酬が自動記録されます。

Q: 「対応する」ボタンとは？
A: タスクに関連するページへ移動するボタンです。例えば、出品確認タスクなら商品登録画面へ遷移します。

Q: 完了履歴を確認するには？
A: タスク画面下部の「完了した履歴を見る」をタップ。完了したタスクは30日後に自動削除されます。

Q: タスク履歴を削除するには？
A: 履歴画面で個別の「削除」ボタン、または「全削除」ボタンで削除できます。

### 通知について

Q: 通知が届かない場合は？
A: 以下を順番に確認してください：
1. ブラウザの通知許可を確認（設定→サイトの設定→通知）
2. PWAをインストールしている場合は再インストール
3. マイページまたは設定画面でFCMトークンを再発行
4. 端末の「おやすみモード」や「集中モード」を確認

Q: バッジが更新されない場合は？
A: アプリを完全に閉じて再起動してください。改善しない場合：
1. ブラウザのキャッシュをクリア
2. PWAをアンインストールして再インストール

Q: プッシュ通知を無効にするには？
A: ブラウザの設定から通知許可を取り消すか、マイページの通知設定でオフにできます。

Q: バッジをクリアするには？
A: 通知画面の「バッジをクリア」ボタンをタップ。ホーム画面のアイコン上の数字が0にリセットされます。

Q: どんな時に通知が届きますか？
A: 以下の場合に通知が届きます：
- 商品が登録された時
- チャットメッセージを受信した時
- タスクが割り当てられた時
- 在庫アラートが発生した時

### マイページについて

Q: マイページで何が確認できますか？
A: 以下の情報が確認できます：
- プロフィール（名前、権限）
- 今月の報酬額と目標金額
- 達成率（プログレスバー表示）
- タスク種別ごとの内訳（件数と金額）
- チーム内ランキング

Q: 目標金額を設定するには？
A: マイページの「目標設定」ボタン（🎯）をタップ → 金額を入力または プリセット（¥5,000/¥10,000/¥20,000/¥30,000/¥50,000）から選択 →「保存」

Q: ランキングとは？
A: チームメンバーの今月の報酬額ランキングです。🥇🥈🥉でトップ3が表示され、自分の順位はハイライト表示されます。

### 管理者向け機能について

Q: 仕入を登録するには？（管理者向け）
A: 仕入管理画面の「仕入登録」タブで以下を入力：
1. 仕入日
2. 仕入先（新規追加も可能）
3. 仕入点数
4. 仕入合計金額
5. 発送先（外注スタッフまたは「自分で管理」）
6. メモ（任意）
登録後、QRコード付きラベルを印刷できます。

Q: QRコードラベルを印刷するには？（管理者向け）
A: 仕入登録後、印刷モードを選択：
- **シンプル印刷**: 4列グリッドで印刷
- **ラベルシート印刷**: 専用ラベル対応（70面/24面/44面/カスタム）
途中から使いかけのシートにも対応（印刷開始位置を指定可能）。

Q: 請求書を発行するには？（管理者向け）
A: 売上管理画面で対象商品を選択 →「請求書発行」→ 請求先、請求日、支払期限を入力 → 明細を確認 →「PDF出力」

Q: 確定申告用のデータを出力するには？（管理者向け）
A: 確定申告画面の「帳簿出力」タブで以下をダウンロードできます：
- 売上帳（売上帳_YYYY年.csv）
- 仕入帳（仕入帳_YYYY年.csv）
- 経費帳（経費帳_YYYY年.csv）
- 全帳簿一括（帳簿一括_YYYY年.csv）

Q: 経費を登録するには？（管理者向け）
A: 確定申告画面の「経費」タブで以下を入力：
1. 日付
2. 勘定科目（通信費/荷造運賃/消耗品費/広告宣伝費/支払手数料など）
3. 金額
4. 摘要（任意）
→「追加」ボタン

Q: 報酬を支払い処理するには？（管理者向け）
A: 報酬管理画面の「支払管理」タブで：
1. 担当者を選択
2. 支払日を入力
3. 支払金額を確認（自動計算）
4.「支払処理」ボタン → 確認後実行

Q: 報酬の単価を設定するには？（管理者向け）
A: 設定管理画面の「報酬設定」で設定できます：
- 商品出品：100円/件（デフォルト）
- 梱包・発送：100円/件
- 商品撮影：50円/件
- 検品作業：30円/件

### アプリについて

Q: PWAとは何ですか？
A: Progressive Web Appの略で、ウェブサイトをスマホアプリのようにホーム画面からアクセスできる技術です。App StoreやGoogle Playからのダウンロードは不要です。通知機能やオフライン対応も可能です。

Q: ホーム画面に追加するには？
A: **iPhoneの場合**：
1. Safariでフリラを開く
2. 共有ボタン（□↑）をタップ
3. 「ホーム画面に追加」を選択
4. 名前を確認して「追加」

**Androidの場合**：
1. Chromeでフリラを開く
2. メニュー（︙）をタップ
3. 「アプリをインストール」または「ホーム画面に追加」を選択

Q: アプリが動作しない場合は？
A: 以下を順番にお試しください：
1. ブラウザのキャッシュをクリア
2. アプリ（PWA）を一度削除して再インストール
3. 別のブラウザ（Safari/Chrome）で試す
4. 端末を再起動
5. それでも解決しない場合はこのAIサポートでお問い合わせください

Q: データのバックアップはありますか？
A: データはクラウド上に自動保存されています。端末を変更しても、同じアカウントでログインすればデータを引き継げます。端末の故障や紛失でもデータは失われません。

Q: ログインできない場合は？
A: 以下を確認してください：
1. メールアドレス・パスワードの入力ミスがないか
2. Caps Lockがオフになっているか
3. パスワードを忘れた場合は「パスワードを忘れた方」から再設定
4. アカウントが無効になっている場合は管理者にお問い合わせください

Q: パスワードを変更したい
A: マイページ→基本情報（⚙️ボタン）→パスワード変更から新しいパスワードを設定できます。

### トラブルシューティング

Q: 画面が真っ白になる
A: キャッシュの問題が考えられます。以下をお試しください：
1. ブラウザを完全に閉じて再起動
2. ブラウザのキャッシュをクリア
3. PWAの場合は削除→再インストール

Q: 保存ボタンを押しても保存されない
A: 以下を確認してください：
1. 必須項目（*マーク）がすべて入力されているか
2. インターネット接続が安定しているか
3. 「保存中...」の表示が消えるまで待つ
4. エラーメッセージが表示されていないか

Q: QRコードが読み取れない
A: 以下をお試しください：
1. カメラの許可を確認（ブラウザ設定）
2. QRコードに汚れや破損がないか確認
3. 明るい場所で読み取る
4. カメラとQRコードの距離を調整
5.「手動で入力」ボタンから管理番号を直接入力

Q: 画像がアップロードできない
A: 以下を確認してください：
1. 画像のファイルサイズが大きすぎないか（推奨：5MB以下）
2. 対応形式（JPG、PNG）か確認
3. インターネット接続が安定しているか
4. 登録枚数の上限（20枚）に達していないか

Q: AI生成ボタンを押しても生成されない
A: 以下を確認してください：
1. 必要な商品情報（ブランド、カテゴリ、状態など）が入力されているか
2. インターネット接続が安定しているか
3. しばらく待ってから再度お試しください
4. それでも生成されない場合は時間をおいて再度お試しください

Q: チャットが表示されない/メッセージが送れない
A: 以下をお試しください：
1. インターネット接続を確認
2. アプリを再起動
3. ログアウト→再ログイン
4. ブラウザのキャッシュをクリア

Q: 印刷がうまくいかない
A: 以下を確認してください：
1. プリンタが正しく接続されているか
2. 用紙サイズの設定が合っているか
3. 「実際のサイズ」で印刷する設定になっているか（拡大縮小なし）
4. ブラウザの印刷プレビューで確認

Q: データが消えた
A: データは通常クラウドに保存されているため消えることはありません。以下を確認してください：
1. 正しいアカウントでログインしているか
2. フィルタ設定で非表示になっていないか
3. 検索条件をリセットして再検索
4. それでも見つからない場合はサポートにお問い合わせください

## 回答のルール
1. **回答は200文字以内を目安に簡潔にまとめる**（長くても300文字以内）
2. 同じ質問が繰り返されても、前回と同程度の長さで回答する（長くしない）
3. 丁寧で親しみやすく、かつプロフェッショナルに対応する
4. 具体的な操作手順を示す（「〇〇画面→△△ボタン」のように）
5. 分からない場合は正直に「その機能については確認が必要です」と伝える
6. フリラのサポート範囲外の質問には「フリラのサポート範囲外となります」と案内する
7. 管理者向け機能について質問された場合は、「管理者権限が必要な機能です」と補足する
8. 複数の解決方法がある場合は、最も簡単な方法を1つだけ提示する`;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Helper function for JSON response
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Handle OPTIONS request (CORS preflight)
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Call Gemini API
async function callGeminiAPI(apiKey, message, history) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  // Build conversation contents
  const contents = [];

  // Add history (convert to Gemini format)
  if (history && history.length > 0) {
    for (const item of history) {
      contents.push({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: item.content }]
      });
    }
  }

  // Add current message if not already in history
  const lastHistoryItem = history && history.length > 0 ? history[history.length - 1] : null;
  if (!lastHistoryItem || lastHistoryItem.content !== message) {
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });
  }

  const requestBody = {
    contents: contents,
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 400,  // 簡潔な回答のため制限（約200-300文字）
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  const response = await fetch(`${url}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract text from response
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    const parts = data.candidates[0].content.parts;
    if (parts && parts[0] && parts[0].text) {
      return parts[0].text;
    }
  }

  throw new Error('Invalid response from Gemini API');
}

// =============================================================================
// 商品説明文AI生成 (GAS gemini_api.js から移植)
// =============================================================================

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const GEMINI_MODEL_TIERS = [
  { name: 'gemini-2.5-flash', tier: 'premium', isThinkingModel: true, minMaxTokens: 4096 },
  { name: 'gemini-2.0-flash', tier: 'standard', isThinkingModel: false, minMaxTokens: 1024 },
  { name: 'gemini-1.5-flash', tier: 'lite', isThinkingModel: false, minMaxTokens: 1024 },
];

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

const MIN_DESCRIPTION_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 300;

function getMinLengthFromConfig(aiConfig) {
  const map = { short: 150, medium: 200, long: 300 };
  return map[aiConfig.length] || MIN_DESCRIPTION_LENGTH;
}

function getMaxLengthFromConfig(aiConfig) {
  const map = { short: 200, medium: 300, long: 500 };
  return map[aiConfig.length] || MAX_DESCRIPTION_LENGTH;
}

/**
 * 商品情報からプロンプトを構築 (GAS buildDescriptionPrompt 移植)
 */
function buildDescriptionPrompt(productInfo, aiConfig, imageCount) {
  if (!productInfo.brandName || !productInfo.itemName) {
    throw new Error('ブランド名とアイテム名は必須です。');
  }

  imageCount = imageCount || 0;
  const config = aiConfig || {};
  const minLength = getMinLengthFromConfig(config);
  const maxLength = getMaxLengthFromConfig(config);

  // カスタムプロンプトテンプレート
  if (config.promptTemplate && config.promptTemplate.trim()) {
    let customPrompt = config.promptTemplate;
    customPrompt = customPrompt
      .replace(/\{brand\}/g, productInfo.brandName + (productInfo.brandKana ? `（${productInfo.brandKana}）` : ''))
      .replace(/\{item\}/g, productInfo.itemName || '')
      .replace(/\{category\}/g, productInfo.category || '')
      .replace(/\{size\}/g, productInfo.size || '')
      .replace(/\{condition\}/g, productInfo.condition || '')
      .replace(/\{material\}/g, productInfo.material || '')
      .replace(/\{color\}/g, productInfo.color || '')
      .replace(/\{attributes\}/g, productInfo.attributes || '')
      .replace(/\{modelNumber\}/g, productInfo.modelNumber || '')
      .replace(/\{length\}/g, `${minLength}-${maxLength}`);
    return customPrompt;
  }

  // デフォルトプロンプト
  let prompt = '';

  if (imageCount > 0) {
    prompt = `あなたはメルカリの出品説明文を作成する専門家です。

**添付された${imageCount}枚の商品画像を詳しく観察し**、画像から読み取れる具体的な情報をメインに、魅力的で購買意欲を高める商品説明文を作成してください。

テキスト情報は補足として参考にしてください。

【商品情報（参考）】`;
  } else {
    prompt = `あなたはメルカリの出品説明文を作成する専門家です。以下の商品情報から、魅力的で購買意欲を高める商品説明文を作成してください。

【商品情報】`;
  }

  if (config.includeBrand !== false && productInfo.brandName) {
    prompt += `\nブランド: ${productInfo.brandName}`;
    if (productInfo.brandKana) prompt += `（${productInfo.brandKana}）`;
  }

  if (config.includeCategory !== false && productInfo.category) {
    prompt += `\nカテゴリ: ${productInfo.category}`;
  }

  prompt += `\nアイテム: ${productInfo.itemName}`;

  if (config.includeSize !== false && productInfo.size) {
    prompt += `\nサイズ: ${productInfo.size}`;
  }

  if (config.includeCondition !== false && productInfo.condition) {
    prompt += `\n状態: ${productInfo.condition}`;
  }

  if (config.includeMaterial !== false && productInfo.material) {
    prompt += `\n素材: ${productInfo.material}`;
  }

  if (config.includeColor !== false && productInfo.color) {
    prompt += `\nカラー: ${productInfo.color}`;
  }

  if (config.includeAttributes !== false && productInfo.attributes) {
    prompt += `\n商品属性: ${productInfo.attributes}`;
  }

  if (productInfo.modelNumber) {
    prompt += `\n品番・型番: ${productInfo.modelNumber}

※重要: この品番・型番でGoogle検索を行い、以下の情報を含めてください：
  - 発売年・シーズン
  - メーカー希望小売価格（定価）
  - 商品の公式説明・特徴
  - 人気度や評価（あれば）
  - 素材やディテールの詳細情報`;
  }

  // トーン
  let toneInstruction = '';
  switch (config.tone) {
    case 'polite':
      toneInstruction = '丁寧で格調高い文体で書いてください。'; break;
    case 'standard':
      toneInstruction = '丁寧で親しみやすい文体で書いてください。プロフェッショナルだが堅苦しくない表現を心がけてください。'; break;
    case 'enthusiastic':
      toneInstruction = '熱量高めで、おすすめ感を強調してください。'; break;
    case 'casual':
    default:
      toneInstruction = 'フレンドリーでカジュアルな文体で書いてください。'; break;
  }

  // 見出しスタイル
  let headingInstruction = '';
  switch (config.headingStyle) {
    case 'emoji':
      headingInstruction = '見出しには絵文字を使ってください。例: ✨ 商品の特徴、👔 コーディネート提案、🎯 おすすめシーン'; break;
    case 'brackets':
      headingInstruction = '見出しには【】を使ってください。例: 【商品の特徴】、【コーディネート提案】、【おすすめシーン】'; break;
    case 'square':
      headingInstruction = '見出しには■を使ってください。例: ■ 商品の特徴、■ コーディネート提案、■ おすすめシーン'; break;
    case 'none':
      headingInstruction = '見出しは使わず、改行のみで区切ってください。'; break;
    default:
      headingInstruction = '見出しには【】を使ってください。例: 【商品の特徴】、【コーディネート提案】、【おすすめシーン】'; break;
  }

  // 画像解析指示
  if (imageCount > 0) {
    prompt += `

【重要: 画像解析を最優先してください】
${imageCount}枚の商品画像が添付されています。

**必ず画像を詳細に観察し、以下の情報を具体的に説明文に含めてください**：

1. **色・柄・プリント**
   - 正確な色名（例: ネイビー、オフホワイト、ベージュ等）
   - 柄の種類（無地、ボーダー、チェック、花柄、プリント等）
   - 柄のサイズや配置

2. **素材感・質感**
   - 見た目から推測される素材（コットン、デニム、ニット、レザー等）
   - 生地の厚み（薄手、中厚、厚手）
   - 表面の質感（光沢、マット、起毛等）

3. **デザイン・ディテール**
   - シルエット（タイト、レギュラー、オーバーサイズ等）
   - 襟の形（ラウンドネック、Vネック、ポロカラー等）
   - ポケットの有無・位置・デザイン
   - ボタン・ファスナーの種類
   - 装飾（刺繍、ワッペン、リブ等）

4. **状態・コンディション**
   - 使用感の有無
   - 汚れ・シミ・ダメージの有無と位置
   - 全体的な綺麗さ

5. **雰囲気・スタイル**
   - カジュアル/フォーマル/ストリート等のテイスト
   - どんなコーディネートに合うか
   - どんなシーンで着られるか

6. **ロゴ・文字・タグ（重要）**
   - ブランドロゴに書かれている文字を正確に読み取る
   - モデル名やシリーズ名（ロゴやタグから読み取れる場合）
   - 品番・型番（タグに記載されている場合）
   - プリントされた文字やグラフィック
   - 内側のタグに書かれている情報

**画像から読み取れる情報を具体的に、詳しく書いてください。特にロゴや文字は正確に読み取り、商品名の特定に活用してください。曖昧な表現は避けてください。**`;
  }

  prompt += `

【作成条件】
1. 文字数: ${minLength}〜${maxLength}文字
2. ${toneInstruction}
3. ${headingInstruction}
4. 以下の要素を含めること：
   - 商品の特徴やアピールポイント`;

  if (config.includeCoordinate !== false) {
    prompt += `\n   - おすすめのコーディネート提案`;
  }

  if (config.includeScene !== false) {
    prompt += `\n   - 着用シーンの提案`;
  }

  prompt += `
5. 自然で読みやすい文章
6. 購入者の視点に立った魅力的な表現
7. 過度な誇張表現は避ける

説明文のみを出力してください。余計な前置きや注釈は不要です。`;

  return prompt;
}

/**
 * 指定モデルでGemini APIを呼び出し (503リトライ + Google Search Grounding対応)
 */
async function callGeminiWithModel(apiKey, prompt, aiConfig, productInfo, images, modelName) {
  const modelConfig = GEMINI_MODEL_TIERS.find(m => m.name === modelName) || GEMINI_MODEL_TIERS[0];
  const config = aiConfig || {};
  const temperature = config.temperature !== undefined ? config.temperature : 0.7;
  const minTokens = modelConfig.isThinkingModel ? modelConfig.minMaxTokens : 1024;
  const maxTokens = Math.max(config.maxTokens || 1024, minTokens);

  // parts構築（テキスト + 画像）
  const parts = [{ text: prompt }];
  if (images && images.length > 0) {
    for (const image of images) {
      parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
    }
  }

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      topP: 0.8,
      topK: 40,
      thinkingConfig: { thinkingBudget: 0 }, // 思考モード無効（コスト削減）
    },
    safetySettings: SAFETY_SETTINGS,
  };

  // Google Search Grounding（品番がある場合）
  let useGoogleSearch = false;
  if (productInfo && productInfo.modelNumber && productInfo.modelNumber.trim()) {
    requestBody.tools = [{ googleSearch: {} }];
    useGoogleSearch = true;
  }

  const url = `${GEMINI_API_BASE_URL}/${modelName}:generateContent?key=${apiKey}`;

  // 503リトライ（最大3回、2秒間隔）
  const MAX_RETRIES = 3;
  let response, statusCode, responseText;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    statusCode = response.status;

    if (statusCode !== 503) break;

    if (attempt < MAX_RETRIES) {
      console.log(`[Description] 503 error (attempt ${attempt}/${MAX_RETRIES}), retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  responseText = await response.text();

  // Google Search Grounding エラー時のフォールバック
  if (statusCode !== 200 && useGoogleSearch) {
    let errorData;
    try { errorData = JSON.parse(responseText); } catch { errorData = {}; }
    const errorMsg = errorData.error?.message || '';
    if (errorMsg.includes('google_search') || errorMsg.includes('googleSearch') || errorMsg.includes('grounding')) {
      console.log('[Description] Google Search Grounding not supported, retrying without it...');
      delete requestBody.tools;
      const retryResp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      statusCode = retryResp.status;
      responseText = await retryResp.text();
    }
  }

  if (statusCode !== 200) {
    let errorData;
    try { errorData = JSON.parse(responseText); } catch { errorData = {}; }
    const errorMessage = errorData.error?.message || `HTTP ${statusCode}`;
    throw new Error(`${statusCode}: ${errorMessage}`);
  }

  const data = JSON.parse(responseText);

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Gemini APIから結果が返されませんでした。');
  }

  const candidate = data.candidates[0];

  if (candidate.finishReason === 'SAFETY') {
    throw new Error('安全性フィルタにより生成がブロックされました。');
  }

  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    throw new Error('生成されたテキストが空です。');
  }

  return candidate.content.parts[0].text.trim();
}

/**
 * フォールバック付きGemini API呼び出し（3段階モデル）
 */
async function callGeminiForDescription(apiKey, prompt, aiConfig, productInfo, images) {
  let lastError = null;

  for (let i = 0; i < GEMINI_MODEL_TIERS.length; i++) {
    const model = GEMINI_MODEL_TIERS[i];
    try {
      console.log(`[Description] Trying model ${i + 1}/${GEMINI_MODEL_TIERS.length}: ${model.name}`);
      const result = await callGeminiWithModel(apiKey, prompt, aiConfig, productInfo, images, model.name);
      console.log(`[Description] Success with ${model.name}`);
      return result;
    } catch (error) {
      lastError = error;
      console.log(`[Description] Error with ${model.name}: ${error.message}`);

      const msg = error.message || '';
      const shouldFallback = msg.includes('429') || msg.includes('503') || msg.includes('500') ||
                             msg.includes('MAX_TOKENS') || msg.includes('空です');

      if (shouldFallback && i < GEMINI_MODEL_TIERS.length - 1) {
        console.log(`[Description] Falling back: ${model.name} -> ${GEMINI_MODEL_TIERS[i + 1].name}`);
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('全てのモデルで生成に失敗しました。');
}

/**
 * EC用商品タイトル+説明文のプロンプトを構築
 */
function buildEcContentPrompt(productInfo, imageCount) {
  let prompt = '';

  if (imageCount > 0) {
    prompt = `あなたはECサイトの商品ページを作成するプロのコピーライターです。

**添付された${imageCount}枚の商品画像を詳しく観察し**、画像から読み取れる情報とテキスト情報を組み合わせて、SEOに最適化された商品タイトルと商品説明文を作成してください。

【商品情報】`;
  } else {
    prompt = `あなたはECサイトの商品ページを作成するプロのコピーライターです。以下の商品情報から、SEOに最適化された商品タイトルと商品説明文を作成してください。

【商品情報】`;
  }

  if (productInfo.brandName) {
    prompt += `\nブランド: ${productInfo.brandName}`;
    if (productInfo.brandKana) prompt += `（${productInfo.brandKana}）`;
  }
  if (productInfo.category) prompt += `\nカテゴリ: ${productInfo.category}`;
  if (productInfo.itemName) prompt += `\nアイテム: ${productInfo.itemName}`;
  if (productInfo.size) prompt += `\nサイズ: ${productInfo.size}`;
  if (productInfo.condition) prompt += `\n状態: ${productInfo.condition}`;
  if (productInfo.material) prompt += `\n素材: ${productInfo.material}`;
  if (productInfo.color) prompt += `\nカラー: ${productInfo.color}`;
  if (productInfo.attributes) prompt += `\n商品属性: ${productInfo.attributes}`;
  if (productInfo.accessories) prompt += `\n付属品: ${productInfo.accessories}`;
  if (productInfo.modelNumber) {
    prompt += `\n品番・型番: ${productInfo.modelNumber}
※この品番でGoogle検索を行い、正式名称・発売情報・特徴を含めてください。`;
  }

  prompt += `

【出力形式】
以下のJSON形式で出力してください。他の文字は一切含めないでください。

{"ecTitle":"商品タイトル","ecDescription":"商品説明文"}

【商品タイトルの作成条件】
- 50〜80文字程度
- ブランド名（英語＋カナ読み）を含める
- アイテムの種類を省略せずに記載（例: パーカー→プルオーバーパーカー）
- サイズ、カラーを含める
- SEOキーワードとなる特徴やディテールを含める（素材感、ロゴ、デザイン特徴など）
- 楽天やZOZOTOWNのような情報量の多いタイトルを参考に
- セールスワード（【送料無料】等）は含めない
- 例: 「NIKE（ナイキ）プルオーバーパーカー メンズ Lサイズ グレー スウッシュ刺繍ロゴ 裏起毛 フーディー」

【商品説明文の作成条件】
- 300〜600文字程度
- 丁寧で読みやすい文体
- 以下の構成で作成：
  1. 商品の概要（1〜2文）
  2. デザイン・素材の特徴
  3. サイズ感や着用イメージ
  4. コンディション（中古品の場合）
  5. おすすめポイント
- HTMLタグは使用しない（プレーンテキスト）
- 見出しには■を使用
- メルカリ特有の表現（即購入OK、プロフ必読等）は含めない
- ハッシュタグは含めない`;

  return prompt;
}

/**
 * /generate-ec-content エンドポイントのハンドラ
 */
async function handleGenerateEcContent(request, env) {
  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const body = await request.json();
  const { productInfo, images } = body;

  if (!productInfo) {
    return jsonResponse({ error: 'productInfo is required' }, 400);
  }

  const imageArray = images || [];
  const prompt = buildEcContentPrompt(productInfo, imageArray.length);
  const generatedText = await callGeminiForDescription(
    env.GEMINI_API_KEY, prompt, {}, productInfo, imageArray
  );

  // JSONパース試行
  try {
    const jsonMatch = generatedText.match(/\{[\s\S]*"ecTitle"[\s\S]*"ecDescription"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return jsonResponse({ success: true, ecTitle: parsed.ecTitle, ecDescription: parsed.ecDescription });
    }
  } catch (e) {
    console.log('[EC Content] JSON parse failed, returning raw text');
  }

  // JSONパース失敗時はそのまま返す
  return jsonResponse({ success: true, ecTitle: '', ecDescription: generatedText });
}

/**
 * /generate-description エンドポイントのハンドラ
 */
async function handleGenerateDescription(request, env) {
  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const body = await request.json();
  const { productInfo, images, aiConfig } = body;

  if (!productInfo || !productInfo.brandName || !productInfo.itemName) {
    return jsonResponse({ error: 'productInfo with brandName and itemName is required' }, 400);
  }

  const imageArray = images || [];
  const prompt = buildDescriptionPrompt(productInfo, aiConfig || {}, imageArray.length);
  const generatedText = await callGeminiForDescription(
    env.GEMINI_API_KEY, prompt, aiConfig || {}, productInfo, imageArray
  );

  return jsonResponse({ success: true, generatedText });
}

// Main handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // Chat endpoint
    if (url.pathname === '/chat' && request.method === 'POST') {
      try {
        // Check API key
        if (!env.GEMINI_API_KEY) {
          console.error('GEMINI_API_KEY not configured');
          return jsonResponse({ error: 'Server configuration error' }, 500);
        }

        // Parse request body
        const body = await request.json();
        const { message, history } = body;

        if (!message || typeof message !== 'string') {
          return jsonResponse({ error: 'Message is required' }, 400);
        }

        // Call Gemini API
        const responseText = await callGeminiAPI(env.GEMINI_API_KEY, message, history || []);

        return jsonResponse({
          response: responseText,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Chat error:', error);
        return jsonResponse({
          error: 'Failed to process message',
          details: error.message
        }, 500);
      }
    }

    // EC content generation endpoint
    if (url.pathname === '/generate-ec-content' && request.method === 'POST') {
      try {
        return await handleGenerateEcContent(request, env);
      } catch (error) {
        console.error('EC content generation error:', error);
        return jsonResponse({
          success: false,
          error: error.message || 'EC用コンテンツの生成に失敗しました。'
        }, 500);
      }
    }

    // Product description generation endpoint
    if (url.pathname === '/generate-description' && request.method === 'POST') {
      try {
        return await handleGenerateDescription(request, env);
      } catch (error) {
        console.error('Description generation error:', error);
        return jsonResponse({
          success: false,
          error: error.message || 'AI説明文の生成に失敗しました。'
        }, 500);
      }
    }

    // 404 for unknown routes
    return jsonResponse({ error: 'Not found' }, 404);
  },
};
