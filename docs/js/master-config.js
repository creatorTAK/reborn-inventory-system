/**
 * マスタ定義設定ファイル
 * 
 * 汎用マスタ管理エンジンで使用するマスタ定義を管理
 * 新しいマスタを追加する場合は、このファイルに定義を追加するだけで動作する
 */

const masterCategories = {
  product: {
    label: '商品関連マスタ',
    icon: '📦',
    description: '商品に関連するマスタデータを管理',
    // サブグループ定義（タブをグループ化）
    subGroups: {
      listing: {
        id: 'listing',
        label: '出品設定',
        icon: 'bi-tag',
        description: 'プラットフォームへの出品時に選択する項目',
        masters: ['brand', 'category', 'size', 'condition']
      },
      description: {
        id: 'description',
        label: '説明文生成',
        icon: 'bi-file-text',
        description: '商品名・説明文に挿入するワード',
        masters: ['material', 'accessory', 'sizeLabel', 'salesword', 'attribute']
      }
    },
    defaultSubGroup: 'listing',
    masters: {
      brand: {
        label: 'ブランド',
        collection: 'brands',
        description: 'ブランド名を管理（英語名・カナ名）',
        fields: [
          {
            name: 'nameEn',
            label: 'ブランド英語名',
            required: true,
            type: 'text',
            placeholder: '例: NIKE',
            validation: {
              minLength: 1,
              maxLength: 100
            }
          },
          {
            name: 'nameKana',
            label: 'ブランドカナ',
            required: true,
            type: 'text',
            placeholder: '例: ナイキ',
            validation: {
              minLength: 1,
              maxLength: 100
            }
          }
        ],
        displayFields: ['nameEn', 'nameKana'], // 一覧画面で表示するフィールド
        searchFields: ['nameEn', 'nameKana', 'searchText'], // 検索対象フィールド
        sortBy: 'nameEn',
        sortOrder: 'asc',
        searchable: true,
        usageCount: true, // 使用回数カウント機能
        bulkDelete: true, // 一括削除機能
        maxDisplayResults: 100, // 表示上限
        initialDisplay: 0, // 初期表示件数（0=検索後のみ表示）
        // カスタムUI設定（ガイダンス強化）
        emptyState: {
          icon: '🏷️',
          showTotalCount: true,
          message: 'ブランド名で検索',
          hint: '例: NIKE, グッチ, シャネル'
        },
        searchPlaceholder: 'ブランド名を入力（英語・カナ対応）'
      },
      
      category: {
        label: 'カテゴリ',
        collection: 'categories',
        description: '商品カテゴリを管理（7階層対応）',
        // プラットフォーム別管理
        platformSupport: true,
        platforms: [
          { id: 'mercari', name: 'メルカリ', icon: '/images/platform/mercari.png' },
          { id: 'mercari-shops', name: 'メルカリShops', icon: '/images/platform/mercari-shops.png' },
          { id: 'yahoo-fleamarket', name: 'Yahoo!フリマ', icon: '/images/platform/yahoo-fleamarket.png' },
          { id: 'yahoo-auction', name: 'Yahoo!オークション', icon: '/images/platform/yahoo-auction.png' },
          { id: 'rakuma', name: 'ラクマ', icon: '/images/platform/rakuma.png' },
          { id: 'base', name: 'BASE', icon: '/images/platform/base.png' },
          { id: 'shopify', name: 'Shopify', icon: '/images/platform/shopify.png' }
        ],
        defaultPlatform: 'mercari',
        // ツリービュー表示モード
        viewMode: 'tree',
        treeConfig: {
          // 6階層（特大分類〜細分類2）+ アイテム名
          levelFields: ['superCategory', 'level1', 'level2', 'level3', 'level4', 'level5'],
          itemNameField: 'itemName',
          defaultExpanded: false
        },
        // カスケード追加・編集設定（商品登録と同じ構造）
        cascadeAdd: {
          enabled: true,
          hideLabels: true,  // ラベル非表示（アイテム名のみ表示）
          levels: [
            { field: 'superCategory', label: '特大分類', conditional: false },
            { field: 'level1', label: '大分類', conditional: false },
            { field: 'level2', label: '中分類', conditional: false },
            { field: 'level3', label: '小分類', conditional: false },
            { field: 'level4', label: '細分類', conditional: true },   // 条件付き表示
            { field: 'level5', label: '細分類2', conditional: true }   // 条件付き表示
          ],
          // 特大分類の固定選択肢（商品登録と同じ）
          superCategoryOptions: [
            'ファッション',
            'ベビー・キッズ',
            '家電・カメラ・AV機器',
            'ゲーム・おもちゃ',
            'スポーツ・アウトドア',
            'コスメ・ヘルスケア',
            'ハンドメイド・手芸',
            'インテリア・住まい',
            '食品・飲料',
            '本・雑誌・漫画',
            'CD・DVD・ブルーレイ',
            'その他'
          ],
          // 既存データ互換：level1（メンズ等）からsuperCategoryへのマッピング
          // fullPathが「メンズ > ...」形式の場合、「ファッション > メンズ > ...」として扱う
          level1ToSuperCategoryMap: {
            'メンズ': 'ファッション',
            'レディース': 'ファッション'
          },
          itemNameLabel: 'アイテム名',
          platformField: 'platforms'
        },
        fields: [
          {
            name: 'fullPath',
            label: 'カテゴリフルパス',
            required: true,
            type: 'text',
            placeholder: '例: ファッション > レディース > トップス > シャツ > 半袖シャツ',
            validation: {
              minLength: 1,
              maxLength: 300
            }
          }
        ],
        displayFields: ['fullPath'],
        searchFields: ['fullPath', 'superCategory', 'level1', 'level2', 'level3', 'level4', 'level5', 'itemName'],
        sortBy: 'fullPath',
        sortOrder: 'asc',
        searchable: true,
        usageCount: true,
        bulkDelete: true,
        maxDisplayResults: 500,
        initialDisplay: 0,
        emptyState: {
          icon: '📁',
          showTotalCount: true,
          message: 'カテゴリ名で検索、または下のツリーから選択',
          hint: '例: レディース, Tシャツ, バッグ'
        },
        searchPlaceholder: 'カテゴリ名を入力'
      },
      
      // 素材マスタ（masterOptions対応）
      material: {
        label: '素材',
        description: '商品の素材情報を管理（箇所・種類）',
        // masterOptionsベースの特殊タイプ
        type: 'masterOptions',
        masterOptionsFields: [
          { key: '素材(箇所)', label: '素材（箇所）', placeholder: '例: 表地', icon: 'bi-geo-alt' },
          { key: '素材(種類)', label: '素材（種類）', placeholder: '例: コットン', icon: 'bi-layers' }
        ],
        emptyState: {
          icon: '🧵',
          message: '素材マスタを管理',
          hint: '箇所と種類を追加・編集できます'
        }
      },

      // サイズマスタ（S/M/L等）- プラットフォーム別対応
      size: {
        label: 'サイズ',
        description: '商品サイズを管理（S/M/L/XL等）',
        type: 'masterOptions',
        // プラットフォーム別管理（カテゴリと同様）
        platformSupport: true,
        defaultPlatform: 'mercari',
        masterOptionsFields: [
          { key: 'サイズ', label: 'サイズ', placeholder: '例: M', icon: 'bi-rulers' }
        ],
        emptyState: {
          icon: '📏',
          message: 'サイズマスタを管理',
          hint: 'S/M/L/XL等のサイズを追加・編集'
        }
      },

      // 商品の状態マスタ - プラットフォーム別対応
      condition: {
        label: '商品の状態',
        description: '商品の状態を管理（新品/中古等）',
        type: 'masterOptions',
        // プラットフォーム別管理（カテゴリ・サイズと同様）
        platformSupport: true,
        defaultPlatform: 'mercari',
        masterOptionsFields: [
          { key: '商品の状態', label: '商品の状態', placeholder: '例: 未使用に近い', icon: 'bi-star' }
        ],
        emptyState: {
          icon: '✨',
          message: '商品の状態マスタを管理',
          hint: '新品/中古等の状態を追加・編集'
        }
      },

      // サイズ(表記)マスタ
      sizeLabel: {
        label: 'サイズ(表記)',
        description: 'サイズの表記方法を管理',
        type: 'masterOptions',
        masterOptionsFields: [
          { key: 'サイズ(表記)', label: 'サイズ(表記)', placeholder: '例: Mサイズ相当', icon: 'bi-tag' }
        ],
        emptyState: {
          icon: '🏷️',
          message: 'サイズ(表記)マスタを管理',
          hint: 'サイズ表記を追加・編集'
        }
      },

      // 商品属性マスタ（18カテゴリ統合・ドロップダウン切替）
      attribute: {
        label: '商品属性',
        description: '商品属性（18カテゴリ）を管理',
        type: 'masterOptionsDropdown',
        masterOptionsCategories: [
          { key: '生地・素材・質感系', label: '生地・素材・質感系', icon: 'bi-layers' },
          { key: '季節感・機能性', label: '季節感・機能性', icon: 'bi-sun' },
          { key: '着用シーン・イベント', label: '着用シーン・イベント', icon: 'bi-calendar-event' },
          { key: '見た目・印象', label: '見た目・印象', icon: 'bi-eye' },
          { key: 'トレンド表現', label: 'トレンド表現', icon: 'bi-graph-up-arrow' },
          { key: 'サイズ感・体型カバー', label: 'サイズ感・体型カバー', icon: 'bi-arrows-angle-expand' },
          { key: '年代・テイスト・スタイル', label: '年代・テイスト・スタイル', icon: 'bi-person' },
          { key: 'カラー/配色/トーン', label: 'カラー/配色/トーン', icon: 'bi-palette' },
          { key: '柄・模様', label: '柄・模様', icon: 'bi-grid-3x3' },
          { key: 'ディテール・仕様', label: 'ディテール・仕様', icon: 'bi-gear' },
          { key: 'シルエット/ライン', label: 'シルエット/ライン', icon: 'bi-body-text' },
          { key: 'ネックライン', label: 'ネックライン', icon: 'bi-chevron-down' },
          { key: '襟・衿', label: '襟・衿', icon: 'bi-chevron-up' },
          { key: '袖・袖付け', label: '袖・袖付け', icon: 'bi-arrows' },
          { key: '丈', label: '丈', icon: 'bi-rulers' },
          { key: '革/加工', label: '革/加工', icon: 'bi-handbag' },
          { key: '毛皮/加工', label: '毛皮/加工', icon: 'bi-cloud' },
          { key: '生産国', label: '生産国', icon: 'bi-globe' }
        ],
        emptyState: {
          icon: '🏷️',
          message: '商品属性を管理',
          hint: 'カテゴリを選択して属性値を追加・編集'
        }
      },

      salesword: {
        label: 'セールスワード',
        collection: 'saleswords',
        type: 'categoryWordsDropdown',
        description: '商品説明で使用するセールスワードを管理',
        wordsField: 'words',
        orderField: 'order',
        icon: 'bi-megaphone',
        placeholder: '例: 大人気',
        emptyState: {
          icon: '📢',
          message: 'セールスワードを管理',
          hint: 'カテゴリを選択してキーワードを追加・編集'
        }
      },
      
      // 削除済み: attributeCategory（masterOptionsに移行済み）

      accessory: {
        label: '付属品',
        collection: 'accessories',
        type: 'simpleList',
        description: '商品の付属品を管理（箱、保存袋、保証書など）',
        displayField: 'name',
        orderField: 'displayOrder',
        icon: 'bi-box',
        placeholder: '例: 箱',
        emptyState: {
          icon: '📦',
          message: '付属品を管理',
          hint: '商品の付属品（箱、保存袋など）を追加'
        }
      },

      attributeValue: {
        label: '商品属性値',
        collection: 'attributeValues',
        description: '各カテゴリーに紐づく商品属性値を管理',
        fields: [
          { 
            name: 'categoryId', 
            label: '属性カテゴリ', 
            required: true, 
            type: 'select',
            placeholder: 'カテゴリを選択',
            options: [], // 動的にattributeCategoriesから取得
            validation: {
              required: true
            }
          },
          { 
            name: 'value', 
            label: '属性値', 
            required: true, 
            type: 'text',
            placeholder: '例: コットン100%',
            validation: {
              minLength: 1,
              maxLength: 100
            }
          }
        ],
        displayFields: ['categoryName', 'value'],
        searchFields: ['categoryName', 'value'],
        sortBy: 'categoryName',
        sortOrder: 'asc',
        searchable: true,
        usageCount: true,
        bulkDelete: true,
        maxDisplayResults: 100,
        // カテゴリー名を表示用に保存（検索・表示用）
        enrichFields: {
          categoryName: {
            source: 'attributeCategories',
            sourceField: 'name',
            linkField: 'categoryId'
          }
        }
      }
    }
  },
  
  business: {
    label: '業務関連マスタ',
    icon: '🏢',
    description: '業務運営に関連するマスタデータを管理',
    // サブグループ定義（タブをグループ化）
    subGroups: {
      delivery: {
        id: 'delivery',
        label: '配送設定',
        icon: 'bi-truck',
        description: '配送・発送に関する設定',
        masters: ['shipping', 'assignee']
      },
      material: {
        id: 'material',
        label: '資材・在庫',
        icon: 'bi-box-seam',
        description: '梱包資材と在庫管理',
        masters: ['packaging']
      },
      partner: {
        id: 'partner',
        label: '取引先',
        icon: 'bi-building',
        description: '仕入先・出品先の管理',
        masters: ['supplier', 'marketplace']
      },
      system: {
        id: 'system',
        label: 'システム設定',
        icon: 'bi-gear',
        description: '管理番号・コード設定',
        masters: ['rank', 'categoryCode']
      }
    },
    defaultSubGroup: 'delivery',
    masters: {
      shipping: {
        label: '発送方法',
        collection: 'shippingMethods',
        description: '発送方法・送料・配送設定を管理',
        fields: [
          {
            name: 'category',
            label: '発送方法（カテゴリ）',
            required: true,
            type: 'text',
            placeholder: '例: らくらくメルカリ便',
            validation: {
              minLength: 1,
              maxLength: 50
            }
          },
          {
            name: 'detail',
            label: '発送方法（詳細）',
            required: true,
            type: 'text',
            placeholder: '例: ネコポス',
            validation: {
              minLength: 1,
              maxLength: 50
            }
          },
          {
            name: 'price',
            label: '送料（円）',
            required: true,
            type: 'number',
            placeholder: '例: 210',
            validation: {
              min: 0,
              max: 100000
            }
          },
          {
            name: 'shippingPayer',
            label: '配送料の負担',
            required: true,
            type: 'select',
            options: [
              { value: 'seller', label: '送料込み（出品者負担）' },
              { value: 'buyer', label: '着払い（購入者負担）' }
            ],
            defaultValue: 'seller'
          },
          {
            name: 'shippingRegion',
            label: '発送元の地域',
            required: false,
            type: 'select',
            options: [
              { value: '', label: '未設定' },
              { value: '北海道', label: '北海道' },
              { value: '青森県', label: '青森県' },
              { value: '岩手県', label: '岩手県' },
              { value: '宮城県', label: '宮城県' },
              { value: '秋田県', label: '秋田県' },
              { value: '山形県', label: '山形県' },
              { value: '福島県', label: '福島県' },
              { value: '茨城県', label: '茨城県' },
              { value: '栃木県', label: '栃木県' },
              { value: '群馬県', label: '群馬県' },
              { value: '埼玉県', label: '埼玉県' },
              { value: '千葉県', label: '千葉県' },
              { value: '東京都', label: '東京都' },
              { value: '神奈川県', label: '神奈川県' },
              { value: '新潟県', label: '新潟県' },
              { value: '富山県', label: '富山県' },
              { value: '石川県', label: '石川県' },
              { value: '福井県', label: '福井県' },
              { value: '山梨県', label: '山梨県' },
              { value: '長野県', label: '長野県' },
              { value: '岐阜県', label: '岐阜県' },
              { value: '静岡県', label: '静岡県' },
              { value: '愛知県', label: '愛知県' },
              { value: '三重県', label: '三重県' },
              { value: '滋賀県', label: '滋賀県' },
              { value: '京都府', label: '京都府' },
              { value: '大阪府', label: '大阪府' },
              { value: '兵庫県', label: '兵庫県' },
              { value: '奈良県', label: '奈良県' },
              { value: '和歌山県', label: '和歌山県' },
              { value: '鳥取県', label: '鳥取県' },
              { value: '島根県', label: '島根県' },
              { value: '岡山県', label: '岡山県' },
              { value: '広島県', label: '広島県' },
              { value: '山口県', label: '山口県' },
              { value: '徳島県', label: '徳島県' },
              { value: '香川県', label: '香川県' },
              { value: '愛媛県', label: '愛媛県' },
              { value: '高知県', label: '高知県' },
              { value: '福岡県', label: '福岡県' },
              { value: '佐賀県', label: '佐賀県' },
              { value: '長崎県', label: '長崎県' },
              { value: '熊本県', label: '熊本県' },
              { value: '大分県', label: '大分県' },
              { value: '宮崎県', label: '宮崎県' },
              { value: '鹿児島県', label: '鹿児島県' },
              { value: '沖縄県', label: '沖縄県' }
            ]
          },
          {
            name: 'shippingDays',
            label: '発送までの日数',
            required: false,
            type: 'select',
            options: [
              { value: '', label: '未設定' },
              { value: '1-2', label: '1〜2日で発送' },
              { value: '2-3', label: '2〜3日で発送' },
              { value: '4-7', label: '4〜7日で発送' }
            ]
          }
        ],
        displayFields: ['category', 'detail', 'price', 'shippingPayer'],
        searchFields: ['category', 'detail', 'name'],
        sortBy: 'category',
        sortOrder: 'asc',
        searchable: true,
        usageCount: false,
        bulkDelete: true,
        maxDisplayResults: 100,
        // アコーディオン表示設定
        groupBy: 'category',
        groupLabel: '発送方法（カテゴリ）',
        itemDisplayMode: 'labeled'
      },
      
      packaging: {
        label: '梱包資材',
        collection: 'packagingMaterials',
        description: '梱包資材と単価を管理',
        fields: [
          {
            name: 'name',
            label: '資材名',
            required: true,
            type: 'text',
            placeholder: '例: A4 ジッパー式ポリ袋',
            validation: {
              minLength: 1,
              maxLength: 100
            }
          },
          {
            name: 'category',
            label: 'カテゴリ',
            required: true,
            type: 'text',
            placeholder: '例: 封筒・袋類',
            validation: {
              minLength: 1,
              maxLength: 50
            }
          },
          {
            name: 'abbreviation',
            label: '略称',
            required: false,
            type: 'text',
            placeholder: '例: A4ジッパ',
            validation: {
              maxLength: 20
            }
          },
          {
            name: 'supplier',
            label: '発注先',
            required: false,
            type: 'text',
            placeholder: '例: Amazon',
            validation: {
              maxLength: 50
            }
          },
          {
            name: 'quantity',
            label: '入数',
            required: true,
            type: 'number',
            placeholder: '例: 100',
            validation: {
              min: 1,
              max: 100000
            }
          },
          {
            name: 'price',
            label: '購入価格（円）',
            required: true,
            type: 'number',
            placeholder: '例: 939',
            validation: {
              min: 0,
              max: 1000000
            }
          }
        ],
        displayFields: ['name', 'category', 'quantity', 'price'],
        searchFields: ['name', 'category', 'abbreviation', 'supplier'],
        sortBy: 'category',
        sortOrder: 'asc',
        searchable: true,
        usageCount: false,
        bulkDelete: true,
        maxDisplayResults: 100
      },
      
      staff: {
        label: '担当者',
        collection: 'staffMembers',
        description: 'スタッフ・担当者を管理',
        fields: [
          { 
            name: 'name', 
            label: '担当者名', 
            required: true, 
            type: 'text',
            placeholder: '例: 山田太郎',
            validation: {
              minLength: 1,
              maxLength: 50
            }
          },
          { 
            name: 'email', 
            label: 'メールアドレス', 
            required: false, 
            type: 'email',
            placeholder: '例: yamada@example.com',
            validation: {
              pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
            }
          },
          { 
            name: 'phone', 
            label: '電話番号', 
            required: false, 
            type: 'tel',
            placeholder: '例: 03-1234-5678',
            validation: {
              maxLength: 20
            }
          }
        ],
        displayFields: ['name', 'email', 'phone'],
        searchFields: ['name', 'email'],
        sortBy: 'name',
        sortOrder: 'asc',
        searchable: true,
        usageCount: false,
        bulkDelete: true,
        maxDisplayResults: 50
      },
      
      supplier: {
        label: '仕入先',
        collection: 'suppliers',
        description: '仕入先情報を管理',
        fields: [
          { 
            name: 'name', 
            label: '仕入先名', 
            required: true, 
            type: 'text',
            placeholder: '例: ABC商事',
            validation: {
              minLength: 1,
              maxLength: 100
            }
          },
          { 
            name: 'contact', 
            label: '担当者', 
            required: false, 
            type: 'text',
            placeholder: '例: 鈴木一郎',
            validation: {
              maxLength: 50
            }
          },
          { 
            name: 'email', 
            label: 'メールアドレス', 
            required: false, 
            type: 'email',
            placeholder: '例: contact@abc.com',
            validation: {
              pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
            }
          },
          { 
            name: 'phone', 
            label: '電話番号', 
            required: false, 
            type: 'tel',
            placeholder: '例: 03-1234-5678',
            validation: {
              maxLength: 20
            }
          }
        ],
        displayFields: ['name', 'contact', 'email'],
        searchFields: ['name', 'contact'],
        sortBy: 'name',
        sortOrder: 'asc',
        searchable: true,
        usageCount: false,
        bulkDelete: true,
        maxDisplayResults: 50
      },

      assignee: {
        label: '発送先',
        collection: 'assignees',
        description: '発送先担当者を管理',
        fields: [
          {
            name: 'name',
            label: '発送先名',
            required: true,
            type: 'text',
            placeholder: '例: Aさん',
            validation: {
              minLength: 1,
              maxLength: 50
            }
          },
          {
            name: 'note',
            label: '備考（担当範囲など）',
            required: false,
            type: 'text',
            placeholder: '例: AA-AZ担当',
            validation: {
              maxLength: 100
            }
          },
          {
            name: 'email',
            label: 'メールアドレス',
            required: false,
            type: 'email',
            placeholder: '例: assignee@example.com',
            validation: {
              pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
            }
          },
          {
            name: 'userId',
            label: 'スタッフ連携（タスク通知用）',
            required: false,
            type: 'user-select',
            placeholder: 'スタッフを選択',
            description: 'スタッフと連携すると、発送時にタスク通知が自動送信されます'
          }
        ],
        displayFields: ['name', 'note'],
        searchFields: ['name', 'note'],
        sortBy: 'name',
        sortOrder: 'asc',
        searchable: true,
        usageCount: false,
        bulkDelete: true,
        maxDisplayResults: 50
      },

      marketplace: {
        label: '出品先',
        collection: 'salesChannels',
        description: '出品先プラットフォームを管理',
        fields: [
          {
            name: 'name',
            label: '出品先名',
            required: true,
            type: 'text',
            placeholder: '例: メルカリ',
            validation: {
              minLength: 1,
              maxLength: 50
            }
          },
          {
            name: 'commission',
            label: '手数料率（%）',
            required: false,
            type: 'number',
            placeholder: '例: 10',
            validation: {
              min: 0,
              max: 100
            }
          },
          {
            name: 'url',
            label: 'URL',
            required: false,
            type: 'url',
            placeholder: '例: https://www.mercari.com',
            validation: {
              pattern: '^https?://.+'
            }
          }
        ],
        displayFields: ['name', 'commission'],
        searchFields: ['name'],
        sortBy: 'name',
        sortOrder: 'asc',
        searchable: true,
        usageCount: false,
        bulkDelete: true,
        maxDisplayResults: 50
      },

      rank: {
        label: '管理番号ランク',
        collection: 'managementRanks',
        description: '管理番号のランク（価格帯区分）を管理',
        fields: [
          {
            name: 'code',
            label: 'ランクコード',
            required: true,
            type: 'text',
            placeholder: '例: A',
            validation: {
              minLength: 1,
              maxLength: 2,
              pattern: '^[A-Za-z0-9]+$'
            }
          },
          {
            name: 'name',
            label: 'ランク名',
            required: true,
            type: 'text',
            placeholder: '例: 高額品',
            validation: {
              minLength: 1,
              maxLength: 30
            }
          },
          {
            name: 'minPrice',
            label: '下限金額（円）',
            required: false,
            type: 'number',
            placeholder: '例: 10000',
            validation: {
              min: 0,
              max: 10000000
            }
          },
          {
            name: 'maxPrice',
            label: '上限金額（円）',
            required: false,
            type: 'number',
            placeholder: '例: 50000',
            validation: {
              min: 0,
              max: 10000000
            }
          },
          {
            name: 'description',
            label: '説明',
            required: false,
            type: 'text',
            placeholder: '例: 仕入価格10,000円以上の商品',
            validation: {
              maxLength: 100
            }
          }
        ],
        displayFields: ['code', 'name', 'minPrice', 'maxPrice'],
        searchFields: ['code', 'name', 'description'],
        sortBy: 'code',
        sortOrder: 'asc',
        searchable: true,
        usageCount: false,
        bulkDelete: true,
        maxDisplayResults: 50
      },

      categoryCode: {
        label: 'カテゴリコード',
        collection: 'categoryCodes',
        description: '管理番号用のカテゴリコードを管理',
        fields: [
          {
            name: 'code',
            label: 'コード',
            required: true,
            type: 'text',
            placeholder: '例: T',
            validation: {
              minLength: 1,
              maxLength: 3,
              pattern: '^[A-Za-z0-9]+$'
            }
          },
          {
            name: 'name',
            label: 'カテゴリ名',
            required: true,
            type: 'text',
            placeholder: '例: トップス',
            validation: {
              minLength: 1,
              maxLength: 50
            }
          }
        ],
        displayFields: ['code', 'name'],
        searchFields: ['code', 'name'],
        sortBy: 'code',
        sortOrder: 'asc',
        searchable: true,
        usageCount: false,
        bulkDelete: true,
        maxDisplayResults: 50
      }
    }
  }
};

// グローバルスコープに公開
window.masterCategories = masterCategories;

console.log('✅ [Master Config] マスタ定義設定読み込み完了');
