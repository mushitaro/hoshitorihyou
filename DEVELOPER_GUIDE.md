# 開発者向けガイド

このドキュメントは、星取表アプリケーションの技術的な仕様、設計思想、および拡張方法について説明します。

## 1. コアコンセプト

### 1.1. データ駆動型UI
このアプリケーションは、JavaScriptのオブジェクト (`maintenanceData` と `years`) を唯一のデータソース (Single Source of Truth) とし、そこから動的にHTMLテーブルを生成しています。UIに対する操作はまずデータ構造を更新し、その後 `initialize()` 関数を呼び出してUI全体を再描画することで画面に反映されます。

### 1.2. `localStorage` による状態保存
アプリケーションの状態（項目データと年度リスト）は、すべてブラウザの `localStorage` にJSON形式で保存されます。これにより、ユーザーがページをリロードしても作業内容が失われません。
- `maintenanceData`: 項目データ
- `years`: 年度リスト

### 1.3. シングルファイル構成
アプリケーションは `index.html` という単一のファイルで構成されており、HTML、CSS、JavaScriptのすべてが含まれています。外部ライブラリとしてBootstrapのみをCDN経由で利用しています。これにより、特別なビルドプロセスなしに、ファイルをブラウザで開くだけで動作します。

## 2. コード構造

### 2.1. HTML
- `<div id="table-container">`: テーブル全体を格納するコンテナです。
- `<thead id="table-header">`: JavaScriptによってテーブルヘッダーが描画される場所です。
- `<tbody id="table-body">`: JavaScriptによってテーブルの本体（項目行）が描画される場所です。
- `<div id="edit-menu">`: 年度のセルをクリックした際に表示されるコンテキストメニューです。
- `<div id="operation-modal">`: 項目の追加・削除や年度操作など、各種操作で利用するモーダルダイアログです。BootstrapのModalコンポーネントを利用しています。

### 2.2. CSS
- `.table-container`: テーブルのスクロールを実現しています。
- `position: sticky`: テーブルのヘッダーと左側の列（実施項目、BOMコード、周期）を固定するために使用しています。`left` プロパティの値は、先行する列の幅に応じて動的に計算・調整されます。
- `.level-N`: 項目の階層レベルに応じて、背景色やインデントを調整しています。

### 2.3. JavaScript
すべてのロジックは `DOMContentLoaded` イベントリスナー内に記述されています。

#### 主要な変数
- `maintenanceData`: すべての項目データを保持する配列。
- `years`: 表示する年度の配列。
- `dataMap`: `id` をキーとして各項目オブジェクトに高速にアクセスするための `Map` オブジェクト。`initialize()` が呼ばれるたびに再構築されます。

#### 主要な関数
- `initialize(openStates)`: アプリケーションの初期化と再描画を行う中心的な関数。
  1. `dataMap` をクリアします。
  2. `processData()` を呼び出し、各項目に `parentId` や `bomCode` を付与します。
  3. `calculateRollups()` を呼び出し、親項目の集計データを計算します。
  4. `renderTable()` を呼び出し、HTMLテーブルを再構築します。
- `saveData()`: 現在の `maintenanceData` と `years` を `localStorage` に保存し、保存通知（Toast）を表示します。
- `renderTable(openStates)`: `maintenanceData` と `years` に基づいてHTMLのテーブルヘッダーとボディを完全に再構築します。`openStates` (展開状態の項目のIDセット) に基づいて階層の表示状態を復元します。
- `processData(items, parentCode, parentId)`: データ配列を再帰的に処理し、BOMコードの自動採番や `parentId` の設定など、描画前の前処理を行います。
- `calculateRollups(item)`: 子要素の計画・実績データを再帰的に集計し、親要素の集計結果 (`rolledUpResults`) を計算します。
- `handle...` で始まる関数群: 各種UIイベント（クリック、入力など）に対応するイベントハンドラです。

## 3. データ構造

### `maintenanceData`
項目の階層構造を表現するオブジェクトの配列です。

```javascript
{
  "id": 1, // 項目の一意なID (Number)
  "task": "原子炉施設", // 項目の名前 (String)
  "level": 1, // 階層レベル (Number)
  "cycle": 2, // 計画周期（年数）。レベル4の項目のみ (Number | '')
  "children": [ /* 子項目のオブジェクト配列 */ ],
  "results": {
    "2024": { "planned": true, "actual": false } // 年度ごとの計画・実績 (Object)
  }
}
```

- `results` オブジェクトのキーは年度（文字列）、値は `{ planned: boolean, actual: boolean }` という形式のオブジェクトです。

## 4. 拡張のためのヒント

### 4.1. 新しいプロパティを項目に追加する
例として、各項目に「担当者」プロパティを追加する場合を考えます。

1.  **データ構造の更新**:
    - `initialMaintenanceData` の各項目に `assignee: ""` のような初期プロパティを追加します。
    - `handleAddTask` で新しい項目を作成する際に、`assignee` プロパティも追加するようにします。
2.  **UIの更新 (`renderTable`)**:
    - ヘッダーに「担当者」列を追加します。
    - 各行を生成する際に、`item.assignee` を表示する `<td>` を追加します。
3.  **編集機能の実装**:
    - 担当者名をクリックした際に `handleEditTask` のような編集機能（インライン編集など）を実装します。
    - 編集後は `saveData()` と `initialize()` を呼び出して状態を保存・再描画します。

### 4.2. 新しい操作を追加する
例として、「項目を複製する」機能を追加する場合を考えます。

1.  **UIの追加**: `renderTable` 内で、各行のアクションアイコンに「複製」アイコンを追加します。
2.  **イベントハンドラの実装**:
    - `tableBody` のクリックイベントリスナーに、複製アイコンがクリックされた場合の処理を追加します。
    - `handleDuplicateTask(itemId)` のような新しい関数を作成します。
3.  **ロジックの実装**:
    - `handleDuplicateTask` 内で、`dataMap` から対象の項目を取得します。
    - 項目のディープコピーを作成し、新しい一意な `id` を採番します。（子要素もすべて再帰的に複製し、新しいIDを振る必要があります）
    - 親項目の `children` 配列に複製した項目を追加します。
    - `saveData()` と `initialize()` を呼び出します。

### 4.3. リファクタリングの提案
現状は単一ファイルでシンプルですが、機能が複雑化する場合は以下のリファクタリングが考えられます。

- **JavaScriptのモジュール化**: 機能ごと（データ処理、UI描画、イベントハンドラなど）にファイルを分割し、ES Modules (`import`/`export`) を利用して管理する。
- **テンプレートリテラルの利用**: `renderTable` 内の `document.createElement` を多用している部分を、テンプレートリテラルやテンプレートエンジン（[lit-html](https://lit.dev/docs/templates/overview/)など）に置き換えることで、HTML構造の可読性を向上させる。
- **状態管理ライブラリの導入**: より複雑な状態管理が必要になった場合、[Redux](https://redux.js.org/) や [Zustand](https://github.com/pmndrs/zustand) のような軽量な状態管理ライブラリの導入を検討する。
