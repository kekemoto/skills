---
name: harness-coder
description: Drive ALL pending specs in a single project (specs/<project-slug>/) to completion sequentially, one at a time, implementing each spec inline (acceptance conditions → tests → implementation → verification → commit). Processes specs in filename-number order (01, 02, ...). Creates ONE feature branch (feature/<project-slug>) off main per run and commits each spec directly onto it (no per-spec PR). main is never touched by the AI — at the end the coder opens a single feature→main PR and the user performs the final merge. Routes any judgment call to the user. Invoke explicitly only — does NOT auto-trigger. Use when the user runs /harness-coder or wants to clear one project's backlog in one go.
---

`specs/<project-slug>/` にある **単一 project の** spec 群を **ファイル名の番号順に 1 本ずつ** 完了まで駆動する実行スキル。
各 spec の **受け入れ条件定義 → 実装 → 検証 → コミット** を coder 自身がインラインで行う（サブエージェントは使わない）。
**明示起動専用**。ユーザーが `/harness-coder` と呼んだときだけ動く。

## このスキルの位置づけ

- **1 回の harness-coder 実行 = 1 project = 1 feature ブランチ = 1 main 向け PR**。`specs/<slug>/` と `feature/<slug>` ブランチは 1:1 で対応する。slug が一致していることが resume・PR 紐付けの根拠
- 各 spec を feature ブランチへ直接コミットしていく（per-spec の PR は作らない）
- **main は AI が一切触らない**。全 spec 完了後に feature→main PR を 1 本作るだけ。マージは **ユーザーの役割**
- spec の新規作成・目的の分解はしない（→ `/harness`・`/harness-spec`）。coder は既にある spec を実装する
- 複数 project が並列で in-flight な場合でも、**1 回の起動で処理するのは 1 project のみ**

## このスキルの責務範囲

- 含む: プリフライト検査 / feature ブランチの作成・resume / spec 一覧の収集と実行順の確定 / 各 spec の受け入れ条件精査・実装・検証・コミット / 各 spec コミット後の feature の push / 判断が要る地点でのユーザー確認 / 統合検証（feature 上の `npm run check` + テスト）/ feature→main のプルリクエスト作成 / 停止判断
- 含まない: **feature→main のマージ** → ユーザーの責務（AI は絶対にしない）
- 含まない: 目的の分解・spec の新規作成 → `/harness`・`/harness-spec` の責務

## 基本原則

- **常に 1 本ずつ**。番号順に進める（番号は依存順に採番されている前提。先行する単位ほど小さい番号）
- **spec を feature ブランチへ直接コミットする**。per-spec の PR は作らない。各 spec は直前の spec が入った feature の先端から続けて実装する
- **人間の都度承認は挟まない**。通常運用の「コミット/PR は都度承認」を、本実行では **feature→main の最終マージという 1 つのゲートに集約する**意図的な運用
- **AI は main を絶対に触らない**。feature→main のマージはユーザーのみが行う
- ユーザー判断が必要な地点（エスカレーション基準該当・仕様の曖昧さ・検証不能）は独断で進めず、**作業を止めてユーザーに上げる**
- 実装は **spec の外に出ない**。不要な変更を混入させない
- 1 本詰まっても全体を止めない。詰まった spec は飛ばすかユーザーに諮り、進められる spec を進める

## ブランチ戦略（feature ブランチ統合モデル）

```
main ──▶ feature/<project-slug>      ← coder が main から 1 回だけ作成
              ← specs/<slug>/01 を feature へ commit（1 spec = 1 commit）
              ← specs/<slug>/02 を feature へ commit
              ← specs/<slug>/03 を feature へ commit
              ← ...
main ◀── feature を merge            ← ここだけ人間（ユーザー）
```

- **slug の同一性**: project slug = feature ブランチ slug = `specs/<slug>/` のディレクトリ名、の **3 つは同じ文字列**。slug が project の同一性を担保する
- **feature ブランチ**: 実行開始時に `main`（リポジトリのデフォルトブランチ）から 1 本だけ作成し、push する。命名は `feature/<project-slug>`。slug は引数で渡されたらそれを使い、なければ「入力」の判定で確定する
- **各 spec のコミット**: feature ブランチ上で直接実装し、1 spec = 1 コミットを作る。per-spec ブランチもプルリクエストも作らない
- **コミット後**: feature を push する。進捗が remote に残り、resume が効く
- **feature→main**: 全 spec 完了後、**feature→main のプルリクエストを作成するだけ**。**マージは絶対にしない**。ユーザーが俯瞰レビューしてマージする。プルリクエスト本文は各 spec コミットの件名を束ねた一覧でよい（詳細は各コミットメッセージが正なので重複させない）
- **他 project への影響なし**: `specs/` 配下の他 project ディレクトリは無視する。feature/<別 slug> ブランチも触らない

## 入力

- 第 1 引数（任意）: **project slug**（= feature ブランチ slug = `specs/<slug>/` ディレクトリ名。例: `play`）。下記の判定ロジックで省略時の挙動が決まる
- spec 範囲指定（任意）: 特定の spec 名・番号・範囲（例: `03 05 07` や `03-06`）を渡されたら、対象 project 内の spec をその範囲に絞る。なければ対象 project の `specs/<slug>/*.md` のうち `status` が `done` でないものを **すべて** 対象にする
  - 1 実行はすべて 1 つの会話文脈で進むため、対象が多いと文脈が重くなる。**バックログが大きいときは範囲指定で数本ずつに分けて回す**とよい（resume は同じ project slug を渡せば効く）

project slug が省略された場合の判定:

1. `specs/` のサブディレクトリを列挙し、`done` でない spec を含むもの（= in-flight project）を集める
2. in-flight project が **1 つだけ** → そこを対象として 1 行で告げ、確定（質問しない）
3. in-flight project が **複数** → `AskUserQuestion` でどの project を進めるか選ばせる（選択肢には slug・残 spec 数・対応 feature ブランチの有無を添える）
4. in-flight project が **0** → その旨を報告して終了する

対象 spec が 1 本も無ければ、その旨を報告して終了する。

## 実行順の確定

1. 上記「入力」の判定で project slug を確定する
2. 対象 project の `specs/<slug>/*.md` を列挙し、ファイル名先頭の 2 桁番号 `<NN>` で昇順ソートする
3. 各 spec の frontmatter `status` を読む
   - `done` → 完了済みとしてスキップ（再開時に重要）
   - `in_progress` → 前回中断の可能性。ユーザーに「再開するか」を確認してから対象に含める
   - `pending` → 対象
4. 確定した project slug・実行順（対象 spec の番号・slug・目的 1 行）と **feature ブランチ名（`feature/<project-slug>`）**を **着手前にユーザーへ提示** する

## プリフライトと feature ブランチの準備

実行順の確定後、最初の spec に着手する前にプリフライト検査を行う。

1. **プルリクエストを作成できる状態か**（リモートへの接続・認証）を確認する。プルリクエスト作成手段が無ければユーザーに案内して停止
2. **作業ツリーがクリーン**か確認する（`git status --porcelain` が空）。未コミットの変更があれば、巻き込み事故を避けるためユーザーに対処を促して停止
3. **feature ブランチが既存かどうか**で分岐する（再実行・中断復帰の判定）:
   - **既存（resume）**: 同名の `feature/<project-slug>` がローカルまたはリモートに既にある場合は、**新規作成せず resume する**。checkout して最新化（`git pull`）し、done 済み spec はスキップして残りから続行する
   - **新規**: 無ければ、現在のブランチが `main`（デフォルトブランチ）であることを確認（違えば警告）し、`main` から `feature/<project-slug>` を作成・checkout して push する
4. resume の判定に使うため、project slug は **再実行時も同じものを渡す**ようユーザーに案内する（引数で固定するのが確実。または `specs/<slug>/` が残っている間は省略時の判定でも自動的に同じ slug が選ばれる）

## 各 spec の実装手順（ループ本体）

feature を checkout した状態で、対象 spec を番号順に 1 本ずつ、以下の手順で実装する。レビューではなく **制約と検証**で品質を担保し、実装内部ではなく **外部から観測できる振る舞い**を評価対象にする。

### 1. spec 読み込み・受け入れ条件定義

- 対象 spec を読み込み、要約・スコープ・受け入れ条件を把握する
- `status` が `done` / `in_progress` なら（基本はスキップ済みだが）念のためユーザーに確認する
- spec が成立条件として弱い・実装手順を書いている・観測点が無い等の問題があれば、その spec を **保留してユーザーに上げる**（`/harness-spec` での再作成を案内）
- 続行と判断したら `status: in_progress` に更新する
- 受け入れ条件を精査し、不足があれば拡充する。各条件に判定方法（自動 / 振る舞い確認）を付け、正常系・失敗系・境界・既存影響を覆う。大きく書き換える場合は spec 側も更新する

受け入れ条件に含めるべき要素: 前提条件 / 契機または入力 / 期待される観測結果 / 許容される影響 / 許容されない影響 / 失敗時の扱い / 維持されるべき条件 / 判定方法または観測方法。

### 2. テスト・検証資産作成

- 機械的検証資産（自動チェック）と振る舞い検証資産（シナリオ・観点表）を用意する
- このプロジェクトでは: ユニットテスト（vitest）/ E2E テスト（Playwright）/ `npm run check`
- 正常系・失敗系・境界条件・既存影響を覆うように構成する。テストコードは唯一の形式ではない
- E2E で文言を検証する場合は `src/shared/constants/messages.ts` を介する（CLAUDE.md 参照）

### 3. 実装

- feature ブランチ上で直接実装する（per-spec ブランチは切らない）
- spec に準拠して変更を入れる。**spec の外に出ない**。不要な変更を混入させない
- 実装中に新たな論点（曖昧さ・リスク・スコープ拡大）や spec 見直しの必要に気づいたら、**作業を止めてユーザーに上げる**（「## エスカレーション」）

### 4. 実行・検証

**機械的検証**: `npm run check` / テストを実行する。失敗を分類し、修正して再実行する。収束しない場合の試行回数は固定しないが、収束見込みが薄いと判断したらユーザーに上げる。機械的検証に通っていない変更は振る舞い検証に進めない。

**振る舞い検証**: spec と受け入れ条件に照らして実行結果を評価する。UI 変更は `/run` / `/verify` の活用も検討。判定に揺らぎがある場合は明示し、判断不能または高不確実ならユーザーに上げる。

### 5. 結果整理・コミット

統合判断に必要な情報を頭の中で圧縮したうえで（変更目的・影響範囲・前提と仮定・検証結果・未解消リスク・切り戻し方針）、人間確認が必要な論点が残っていればコミットせずユーザーに上げる。なければ：

1. spec の frontmatter `status` を `done` に更新する
2. 変更をステージングし、**下記フォーマットの本文を持つコミットメッセージ**で **feature ブランチに 1 個のコミット**を作る（都度承認なし）
3. feature を push する
4. 短く進捗報告する（どの spec が done になったか / スキップ・保留があればその理由 / 残り本数と次の spec）。実装詳細は載せない

各 spec が終わったら次の spec へ。**非自明な仮定**（複数の妥当な解釈がありえたが自律確定したもの・明示されない前提を補ったもの）は、後で覆ると影響が出るものだけ進捗報告に一言添える。

#### コミットメッセージのフォーマット

**per-spec のプルリクエストを作らないぶん、PR 本文に書いていた内容はすべてコミットメッセージに載せる**。レビュアー（最終的に feature→main をマージするユーザー）が、後からこのコミット 1 個を見れば統合判断できることを目標にする。件名は spec の目的を 1 行で要約し、本文は以下のセクションを必ず書く。

```
<件名: spec の目的を 1 行で（命令形・簡潔に）>

## 何を変えたか
意図ベースで書く。「どのファイルをどう触ったか」の差分説明ではなく、
「何を成立させたか／どんな振る舞いになったか」を書く。

## 設計判断と却下した代替案
採用した方針と、検討して見送った代替案・その理由。
spec で確定済みの方針も、実装中に選んだ非自明な判断も含める。

## テストでカバーした範囲
自動検証（ユニット / E2E / `npm run check`）と振る舞い検証で
「何を確認できたか」を観点で書く。

## テストでカバーしていない範囲   ← 重要・正直に
検証していない経路・条件・前提。手動確認に留めた点。
「無い」と思っても一度疑って書き出す。空欄にしない。

## 自信のない箇所・懸念   ← 重要・正直に
判定に揺らぎがあった点・未解消リスク・将来壊れそうな箇所。
無ければ「なし」と明記する（書き忘れと区別するため）。

## 影響範囲とロールバック手順
触れたモジュール / テーブル / 公開 API。既存への影響。
この spec 単位でどう戻せるか（コミット revert で足りるか、
マイグレーションやデータ整合性の考慮が要るか）。
```

- 「テストでカバーしていない範囲」「自信のない箇所・懸念」は **最重要**。ここを省くと、PR レビューの代わりにこのコミットメッセージで統合判断するという前提が崩れる。正直に・具体的に書く
- 各セクションは spec とフェーズ 1〜4 の結果から自分で埋める。空セクションを作らない（該当なしなら「なし」と書く）
- プロジェクトのコミット規約（フッターなど）があればそれにも従う

## エスカレーション（ユーザー確認）

各 spec の作業は、その変更が触れるリスクを `../harness/risk-criteria.md` のゾーン判定（🔴 Danger / 🟡 Caution / 🟢 Free。**置き場所ではなく振る舞いで判定**）に照らして扱う。

- **🔴 Danger / ゾーンに依らず止める論点に該当** → **作業を止めてユーザーに上げる**。該当要素の一覧と判定基準は `../harness/risk-criteria.md` が正本
- **🟡 Caution** → 止めずに自律で進める。ただし**コミットメッセージの「設計判断」「影響範囲」「自信のない箇所」に必ず明記**し、feature→main マージ時のサマリーレビューに載せる
- **🟢 Free** → ノールックで自律
- spec が成立条件として弱い / 実装中に大きな曖昧さが出た / 検証が判断不能、も Danger 同様に止める
- 止める場合、複数選択肢があれば `AskUserQuestion` で論点・影響範囲・選択肢・推奨案を提示する
- ユーザーが「スキップ / 取り下げ」を選んだら、その spec を未完了のまま記録して次へ進む
- ユーザー回答が「spec を直すべき」なら、`/harness-spec` での修正を案内し、その spec はスキップして次へ
- 逐次なのでエスカレーションは溜めず、その場で上げる

## 統合検証（feature→main PR の前）

per-spec の都度レビューを省いているため、組み上がった feature を **最後に 1 回だけ** 通しで検証する安全網を設ける。

- 全 spec のコミット完了後、feature ブランチ上で `npm run check` とテスト（`npm run test`）を実行する
- **通れば** feature→main PR を作成し、全体サマリ（done / skip の内訳、feature にコミットされた spec 一覧、統合検証の結果、feature→main PR の URL）を提示して終了する。最後に「feature→main のマージはあなた（ユーザー）が行ってください」と明示する
- **落ちたら** ユーザーに上げる。原因の要約を添え、feature→main PR は作らない（または draft で作る）。独断で main へ反映しない
- 個々の spec はコミット済みなので、ここで落ちるのは主に **spec 間の統合起因**。どの spec の組み合わせで壊れたかを切り分けてユーザーに渡す
- ユーザーが途中で停止を指示したら、その時点までの進捗（feature ブランチの状態）を報告して終了する

## 注意

- **AI は main を絶対に触らない**。push もマージもしない。AI が push してよいのは **対象 project の** feature ブランチだけ。別 project の feature ブランチも触らない
- spec を 1 本ずつ feature に積むので、深いブランチスタックにはならない
- 番号順で進めて成立しない spec が出たら、依存順の前提が崩れているサインなので保留してユーザーに諮る
- per-spec を都度レビューしたいとユーザーが望む場合は、spec ごとにコミット後いったん停止して差分を提示してから次へ進む（運用オプション）
- バックログが大きく 1 実行の文脈が重くなりそうなら、範囲指定で分割実行する
- 別 project（別の `specs/<slug>/`）を同じ実行で扱わない。別 project は別途 `/harness-coder <その slug>` を起動する

## 連携 skill

- `/harness-spec` — spec の修正が必要と判明したときユーザーに案内
- `/harness-hearing` — そもそも目的が 1 巡で収まらない／spec 群の再設計が要るとき
- `/harness` — 入口オーケストレータ。状態を見て coder を呼ぶかどうかを判断する
- `../harness/risk-criteria.md` — エスカレーション要否の判定基準として参照
- `/verify`, `/run` — 振る舞い検証で必要に応じて
- `AskUserQuestion` — エスカレーションで選択肢を提示するとき
