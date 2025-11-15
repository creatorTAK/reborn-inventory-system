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
        // オートコンプリート設定（重要マスタ専用）
        autocomplete: true, // オートコンプリート有効化
        autocompleteMinChars: 1, // 最小入力文字数
        autocompleteSuggestions: 20, // 候補表示数
        initialDisplay: 0, // 初期表示件数（0=検索後のみ表示）
        autocompleteFields: { // オートコンプリート候補の表示フィールド
          primary: 'nameEn',   // 1行目（メイン）
          secondary: 'nameKana' // 2行目（サブ）
        }
      },
      
      category: {
        label: 'カテゴリ',
        collection: 'categories',
        description: '商品カテゴリを管理',
        fields: [
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
          },
          {
            name: 'parent',
            label: '親カテゴリ',
            required: false,
            type: 'select',
            placeholder: '親カテゴリを選択（オプション）',
            options: [] // 動的に他のカテゴリから取得
          }
        ],
        displayFields: ['name', 'parent'],
        searchFields: ['name'],
        sortBy: 'name',
        sortOrder: 'asc',
        searchable: true,
        usageCount: true,
        bulkDelete: true,
        maxDisplayResults: 100,
        // オートコンプリート設定（重要マスタ専用）
        autocomplete: true, // オートコンプリート有効化
        autocompleteMinChars: 1, // 最小入力文字数
        autocompleteSuggestions: 15, // 候補表示数
        initialDisplay: 0, // 初期表示件数（0=検索後のみ表示）
        autocompleteFields: { // オートコンプリート候補の表示フィールド
          primary: 'name',   // 1行目（メイン）
          secondary: 'parent' // 2行目（サブ）
        }
      },
      
      material: {
        label: '素材',
        collection: 'materials',
        description: '商品素材を管理',
        fields: [
          { 
            name: 'name', 
            label: '素材名', 
            required: true, 
            type: 'text',
            placeholder: '例: コットン100%',
            validation: {
              minLength: 1,
              maxLength: 100
            }
          }
        ],
        displayFields: ['name'],
        searchFields: ['name'],
        sortBy: 'name',
        sortOrder: 'asc',
        searchable: true,
        usageCount: true,
        bulkDelete: true,
        maxDisplayResults: 100
      },
      
      fabric: {
        label: '生地',
        collection: 'fabrics',
        description: '生地種類を管理',
        fields: [
          { 
            name: 'name', 
            label: '生地名', 
            required: true, 
            type: 'text',
            placeholder: '例: デニム',
            validation: {
              minLength: 1,
              maxLength: 100
            }
          }
        ],
        displayFields: ['name'],
        searchFields: ['name'],
        sortBy: 'name',
        sortOrder: 'asc',
        searchable: true,
        usageCount: true,
        bulkDelete: true,
        maxDisplayResults: 100
      },
      
      keyword: {
        label: 'キーワード',
        collection: 'keywords',
        description: '商品検索用キーワードを管理',
        fields: [
          { 
            name: 'keyword', 
            label: 'キーワード', 
            required: true, 
            type: 'text',
            placeholder: '例: ヴィンテージ',
            validation: {
              minLength: 1,
              maxLength: 50
            }
          }
        ],
        displayFields: ['keyword'],
        searchFields: ['keyword'],
        sortBy: 'keyword',
        sortOrder: 'asc',
        searchable: true,
        usageCount: true,
        bulkDelete: true,
        maxDisplayResults: 100
      },
      
      salesword: {
        label: 'セールスワード',
        collection: 'saleswords',
        description: '商品説明で使用するセールスワードを管理',
        fields: [
          { 
            name: 'word', 
            label: 'セールスワード', 
            required: true, 
            type: 'text',
            placeholder: '例: 大人気',
            validation: {
              minLength: 1,
              maxLength: 50
            }
          }
        ],
        displayFields: ['word'],
        searchFields: ['word'],
        sortBy: 'word',
        sortOrder: 'asc',
        searchable: true,
        usageCount: true,
        bulkDelete: true,
        maxDisplayResults: 100
      },
      
      attributeCategory: {
        label: '商品属性カテゴリ',
        collection: 'attributeCategories',
        description: '商品属性のカテゴリ（18種類）を管理',
        fields: [
          { 
            name: 'name', 
            label: 'カテゴリ名', 
            required: true, 
            type: 'text',
            placeholder: '例: 生地・素材・質感系',
            validation: {
              minLength: 1,
              maxLength: 50
            }
          },
          { 
            name: 'displayOrder', 
            label: '表示順', 
            required: false, 
            type: 'number',
            placeholder: '例: 1',
            validation: {
              min: 1,
              max: 100
            }
          }
        ],
        displayFields: ['name', 'displayOrder'],
        searchFields: ['name'],
        sortBy: 'displayOrder',
        sortOrder: 'asc',
        searchable: true,
        usageCount: true,
        bulkDelete: true,
        maxDisplayResults: 100,
        defaultData: [
          { name: '生地・素材・質感系', displayOrder: 1 },
          { name: '季節感・機能性', displayOrder: 2 },
          { name: '着用シーン・イベント', displayOrder: 3 },
          { name: '見た目・印象', displayOrder: 4 },
          { name: 'トレンド表現', displayOrder: 5 },
          { name: 'サイズ感・体型カバー', displayOrder: 6 },
          { name: '年代・テイスト・スタイル', displayOrder: 7 },
          { name: 'カラー/配色/トーン', displayOrder: 8 },
          { name: '柄・模様', displayOrder: 9 },
          { name: 'ディテール・仕様', displayOrder: 10 },
          { name: 'シルエット/ライン', displayOrder: 11 },
          { name: 'ネックライン', displayOrder: 12 },
          { name: '襟・衿', displayOrder: 13 },
          { name: '袖・袖付け', displayOrder: 14 },
          { name: '丈', displayOrder: 15 },
          { name: '革/加工', displayOrder: 16 },
          { name: '毛皮/加工', displayOrder: 17 },
          { name: '生産国', displayOrder: 18 }
        ]
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
    masters: {
      shipping: {
        label: '発送方法',
        collection: 'shippingMethods',
        description: '発送方法と送料を管理',
        fields: [
          { 
            name: 'name', 
            label: '発送方法名', 
            required: true, 
            type: 'text',
            placeholder: '例: ゆうパック',
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
            placeholder: '例: 700',
            validation: {
              min: 0,
              max: 100000
            }
          },
          { 
            name: 'description', 
            label: '説明', 
            required: false, 
            type: 'textarea',
            placeholder: '例: 追跡あり、補償なし',
            validation: {
              maxLength: 500
            }
          }
        ],
        displayFields: ['name', 'price'],
        searchFields: ['name'],
        sortBy: 'name',
        sortOrder: 'asc',
        searchable: true,
        usageCount: false,
        bulkDelete: true,
        maxDisplayResults: 50
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
            placeholder: '例: OPP袋',
            validation: {
              minLength: 1,
              maxLength: 50
            }
          },
          { 
            name: 'abbreviation', 
            label: '略称', 
            required: true, 
            type: 'text',
            placeholder: '例: OPP',
            validation: {
              minLength: 1,
              maxLength: 20
            }
          },
          { 
            name: 'unitPrice', 
            label: '単価（円）', 
            required: true, 
            type: 'number',
            placeholder: '例: 10',
            validation: {
              min: 0,
              max: 100000
            }
          }
        ],
        displayFields: ['name', 'abbreviation', 'unitPrice'],
        searchFields: ['name', 'abbreviation'],
        sortBy: 'name',
        sortOrder: 'asc',
        searchable: true,
        usageCount: false,
        bulkDelete: true,
        maxDisplayResults: 50
      },
      
      staff: {
        label: '担当者',
        collection: 'staff',
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
      
      marketplace: {
        label: '出品先',
        collection: 'marketplaces',
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
      }
    }
  }
};

// グローバルスコープに公開
window.masterCategories = masterCategories;

console.log('✅ [Master Config] マスタ定義設定読み込み完了');
