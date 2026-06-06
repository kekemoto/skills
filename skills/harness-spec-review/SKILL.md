---
name: harness-spec-review
description: Review pending specs in specs/<project-slug>/ at the spec-review gate, BEFORE implementation. Reviews ONE project at a time. Reads the whole spec set, surfaces concerns (weak acceptance conditions, missing observation points, leaked HOW, cross-spec dependency/boundary conflicts, gaps or scope overlaps between PRs), collects each spec's documented assumptions & uncertainties, classifies risk inline against ../harness/risk-criteria.md, then resolves the open points with the user via AskUserQuestion and writes the confirmed decisions back into the spec files. Does NOT implement and does NOT chain to harness-coder. Invoke explicitly only — typically between spec creation (harness-hearing / harness-spec) and harness-coder.
---

`specs/<project-slug>/` にある **単一 project の** spec 群を **実装着手前に** レビューするスキル。
spec 作成（`/harness-hearing`・`/harness-spec`）と実装（`/harness-coder`）の間にある **spec レビューゲート**で、AI が懸念を洗い出し、spec に記録された仮定・不確実性とあわせて `AskUserQuestion` で解消し、**確定した内容を spec に書き戻す**。
**明示起動専用**。実装には進まない。**`/harness-coder` を自分から呼ばない**。

複数 project が並列で in-flight な場合でも、このスキルは **1 回の起動で 1 project だけ**をレビューする（横断観点は project 内のみ。project 間の整合は意図的に対象外）。

## このスキルの位置づけ

- harness フローの **「spec を作り終えた → まだ実装していない」段階**で使う。手戻りが最も安い「実装前」に spec の弱さ・曖昧さ・spec 間の不整合を潰すのが目的
- ゲートの「人間が spec を目視する」だけだった部分に、AI による事前レビューを足す。人間の最終レビューを置き換えるものではない
- 「懸念の洗い出し → 解消 → spec への記録」までを担う。**spec の全面書き換え・実装・検証はしない**

## このスキルの責務範囲

- 含む: spec 群の収集 / 品質観点・横断観点での懸念洗い出し / 各 spec の仮定・不確実性の抽出 / `../harness/risk-criteria.md` に照らしたリスク判定 / `AskUserQuestion` での解消 / 確定内容の spec への書き戻し / 解消結果の報告
- 含まない: 目的の分解・spec の新規作成 → `/harness-hearing`・`/harness-spec`
- 含まない: 実装・テスト・検証・コミット → `/harness-coder`
- 含まない: どの段階を実行すべきかの判断 → `/harness` オーケストレータ

## 基本原則

- **ユーザーは spec ファイルをほとんど読んでいない前提で書く。** spec を読み込んでいるのは AI 側だけ。だから `AskUserQuestion` の各問は、spec を開かなくても判断できるよう **自己完結**させる。「どの spec の・何についての話か（前提）」「各選択肢が何を意味し、何が変わるか」「なぜその案を推すか（推奨理由）」をすべて問いの中に書く。spec の用語・略記をそのまま投げない
- **網羅レビューではない。** 「この spec のまま実装に入ると手戻りするか」を基準に **懸念を絞る**。揚げ足取りや好みの指摘はしない。ただし *絞った後* の選別は懸念の洗い出しまで。何を質問するかではない
- **洗い出した懸念・spec に記録済みの仮定・不確実性は、すべて `AskUserQuestion` でユーザーに確認する。** AI が「局所だから安く直せる」と判断しても黙って確定しない — レビューゲートの価値は人間が確認することにある。手戻りの広がり（局所 / 横断）は **質問するかどうか**ではなく、**推奨案の出し方・選択肢の重み**に使う（下記ステップ 4）
- **リスク判定の正本は `../harness/risk-criteria.md`。** 🔴 相当は止めてユーザーに上げる
- spec は実装手順ではなく**外部から観測できる成立条件**で書かれているべき、という `/harness-spec` の原則をレビュー基準としてそのまま使う
- **実装に進まない・coder を呼ばない。** ゲートの停止条件を尊重する

## 入力

- 第 1 引数（任意）: **project slug**（= `specs/<project-slug>/` のディレクトリ名）。下記の判定ロジックで省略時の挙動が決まる
- spec 範囲指定（任意）: 特定の spec 名・番号・範囲（例: `03 05` や `03-06`）。なければ対象 project の `specs/<slug>/*.md` のうち `status` が `done` でないものを **すべて** 対象にする
  - `done` の spec は実装済みなのでレビュー対象外（明示指定された場合のみ含める）

project slug が省略された場合の判定:

1. `specs/` のサブディレクトリを列挙し、`done` でない spec を含むもの（= in-flight project）を集める
2. in-flight project が **1 つだけ** → そこを対象として 1 行で告げ、確定（質問しない）
3. in-flight project が **複数** → `AskUserQuestion` でレビュー対象 project を選ばせる（選択肢には slug と残 spec 数の概要を添える）
4. in-flight project が **0** → その旨を報告して終了する

対象 spec が 1 本も無ければ、その旨を報告して終了する。

## ステップ駆動

各ステップ終了時に簡潔にユーザー報告する。

### 1. 対象収集

- 上記「入力」の判定で project slug を確定する（in-flight が複数なら AskUserQuestion）
- 対象 project の `specs/<slug>/*.md` をファイル名先頭の 2 桁番号 `<NN>` で昇順に列挙し、`status` を読む
- `done` はスキップ、`pending` / `in_progress` を対象にする（範囲指定があればそれに絞る）
- 対象 project の slug と、対象 spec の番号・slug・目的 1 行を一覧で提示する

### 2. 懸念の洗い出し（レビュー本体）

対象 spec を **2 つの観点**で読む。

**a. spec 単体の品質観点**（`/harness-spec` の作法を基準にする）

- 受け入れ条件が成立条件として弱い／検証できない（観測点が無い・判定方法が無い）
- 受け入れ条件に **HOW（具体的な数値・ライブラリ・関数名・制御構造）が漏れている**（spec は WHAT で書く）
- 失敗時の振る舞いが抜けている／エラー経路があるのに「実行時挙動なし」になっている
- 要約とスコープ・受け入れ条件が食い違っている
- スコープが 1 統合単位（≒ 1 PR ≒ 1 目的）を超えている／曖昧

**b. spec 群の横断観点**（このスキル固有の価値）

- **依存順の矛盾**: 先行成果物に乗る spec が、依存先より小さい番号になっていない（番号順 = 実装順 = 依存順が崩れている）
- **モジュール境界の置き方の不整合**: 同じ関心事が複数 spec に分散、または 1 spec が複数モジュール（user / stories / play）をまたいでいる（`CLAUDE.md` の境界ルール参照）
- **PR 間の隙間**: どの spec も担っていない必須の繋ぎがある
- **スコープ重複**: 同じ変更を複数 spec が二重に定義している

そのうえで、各 spec の **`仮定 / 不確実性` セクションを抽出**する。hearing/spec が局所と判断して assume した前提が、PR 分解の結果として実は横断的だった、というケースをここで拾い直す。

### 3. リスク判定

洗い出した懸念と、spec が触れる変更内容を `../harness/risk-criteria.md` のゾーン定義に照らして判定する。判定は **置き場所でなく振る舞い**で行い、複数該当は上位ゾーンを採る。迷ったら上位（厳しい側）に倒す。

- **🔴 Danger / ゾーンに依らず止める論点に該当** → 仮定で処理せず、論点・影響範囲・選択肢・推奨案を提示して **止めてユーザーに上げる**
- **🟡 Caution / 🟢 Free** → ステップ 4 へ。Caution は spec の `仮定 / 不確実性` に「設計判断・自信のない箇所」として残す対象

### 4. 確認（AskUserQuestion）

ステップ 2 で洗い出した懸念・spec に記録済みの仮定・不確実性を、**すべて `AskUserQuestion` でユーザーに確認する**。各項目について「現状のままで問題ないか／どう変えるか」を提示し、確定はユーザーに委ねる。

**ユーザーは spec を読んでいない前提なので、各問は spec を開かずに答えられるよう自己完結させる**（基本原則参照）。具体的には：

- **question 本文に前提を書く** — どの spec（番号・slug）の、どの箇所についての話か。現状 spec がどう書いているか・なぜ論点になるかを 1〜2 文で示してから問う
- **各 option の description に「その選択肢を選ぶと何がどう変わるか」を書く** — ラベルだけで意味が伝わらない選択肢にしない
- **推奨案には推奨理由を description に明記する** — なぜその案を推すか（手戻りが小さい／既存の境界に沿う／後で変えやすい等）。`(Recommended)` を付けて先頭に置く

手戻りの広がりは **質問の有無ではなく、推奨案と選択肢の出し方**に使う。

| 手戻りの広がり | 例 | 確認の出し方 |
| --- | --- | --- |
| **局所** — 1 spec 内で安く直せる | 画面文言、内部命名、実装手法の細部、UI レイアウト | 推奨修正案を `(Recommended)` で先頭に置き「これで問題ないか」を確認（ユーザーは Other で覆せる）|
| **横断** — 複数 spec の再分解・再実装に波及／後から変えにくい | データ形状・DB スキーマ、公開 API シグネチャ、モジュール境界、PR 分割の前提、認証・セッション方式 | 選択肢を厚めに出し、**影響範囲を description に明示**して確定を仰ぐ |
| **リスクゾーン該当** | 認証・認可、課金、個人情報・機密、削除・不可逆、公開契約変更、DB スキーマ変更 | 単純な確認では済まない。ステップ 3 のエスカレーション報告（論点・影響範囲・選択肢・推奨案）として上げる |

- **「実装時に判断すれば足りる」と思える不確実性も、残置の是非自体を確認する**。勝手に残さない。確認の結果「実装時判断でよい」となったものだけ `不確実性` として残す
- 項目が多いときは **spec ごと・テーマごとにまとめて複数回**に分ける（1 回 1〜4 問）。header と description を明確に、推奨案は先頭に `(Recommended)`、「Other」は手動追加しない（`/harness-hearing` と同じ作法）

### 5. 書き戻し

ステップ 4 で **確認・確定した内容**を **対象 spec ファイルに直接反映**する。coder がそのまま拾えるようにするのが目的。ユーザー確認を経ていない変更は spec に書かない。

- **確定した仮定** → 該当セクション（受け入れ条件・スコープ・失敗時の振る舞い等）に確定事項として反映し、`仮定 / 不確実性` 側は「確定済み（→ どこに反映したか）」に書き換える
- **弱い受け入れ条件** → 観測点・判定方法を補って強化する。大きく変わる場合は要約のコア受け入れ条件も揃える
- **HOW の漏れ** → WHAT に書き直す
- **横断の不整合（依存順・境界・隙間・重複）** → 番号の振り直しや spec の分割・統合が必要な場合は、**spec を勝手に再設計せず** `/harness-spec`・`/harness-hearing` での修正を案内する（このスキルは記録と提案まで）
- **残した不確実性** → `仮定 / 不確実性` の `不確実性` に、実装時に判断する旨を残す
- spec の `status` は変更しない（レビューは実装ライフサイクルの外。`pending` のまま）

編集は最小限にし、spec の意味を保つ。意味が変わる書き換えはユーザー確認を経てから行う。

### 仕上げ: 報告・停止

ここで harness-spec-review としての作業を閉じる。以下を提示する：

- レビューした spec 一覧
- spec ごとに「何を確認し、どう確定したか」「何を不確実性として残すと確認できたか」
- 横断観点で見つけた spec 間の問題と、必要なら `/harness-spec`・`/harness-hearing` での修正案内
- 🔴 で止めた論点があればその扱い

そのうえで **停止する**。spec レビューゲートを維持し、**実装へは自動で進まない**。次の案内を添える：

> spec の更新を確認のうえ、実装するなら `/harness-coder`（または入口の `/harness`）を実行してください。

## 注意

- **このスキル自身は実装に進まない・`/harness-coder` を呼ばない。** ゲートの停止条件を尊重する
- spec の全面書き換えや再設計はしない。番号振り直し・分割・統合が要るときは `/harness-spec`・`/harness-hearing` に案内する
- レビューは人間の最終 spec レビューを置き換えない。AI が拾える論点を前倒しで潰すための補助
- 軽微・自明な spec で毎回フル報告を出さない。直すものが無ければ「懸念なし」と短く返す

## 連携 skill

- `../harness/risk-criteria.md` — ステップ 3 のリスク判定基準（正本）
- `AskUserQuestion` — ステップ 4 の解消
- `/harness-spec` — spec 単体の修正・再作成が必要なときユーザーに案内
- `/harness-hearing` — spec 群の再分解・再設計が要るときユーザーに案内
- `/harness-coder` — レビュー後の実装引き継ぎ先（このスキルは呼ばない。ユーザーが明示起動する）
- `/harness` — 入口オーケストレータ。ゲートでこのスキルを推奨提示する
