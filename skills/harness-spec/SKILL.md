---
name: harness-spec
description: Author a spec for one integration unit (1 PR ≒ 1 purpose ≒ 1 verifiable unit). Drafts from current conversation context, asks only about genuine ambiguities, and saves to specs/<project-slug>/<NN>-<unit-slug>.md. Use when starting a non-trivial change or when explicitly asked to write a spec.
---

統合単位（≒ 1 PR ≒ 1 目的 ≒ 1 検証可能単位）の spec を作る。
「どう実装するか」ではなく「何が成り立てば完了とみなせるか」を書く。

## 動作（ハイブリッド方式）

1. **現在の会話文脈から spec の草案を組み立てる**。コードベース調査が必要なら最小限の範囲で行う
2. **明確な仮定で埋められる箇所は埋める**。仮定は最後の「仮定 / 不確実性」セクションに必ず明示する
3. **本質的に曖昧な点だけユーザーに質問する**。複数の妥当な解釈が併存する場合・優劣を AI が判断できない場合のみ
4. **どの project に属する spec かを確定する**（下記「project slug の決め方」）
5. **草案を提示し承認を得る**
6. **承認後、`specs/<project-slug>/<NN>-<unit-slug>.md` に保存する**（project ディレクトリがなければ作成）
7. **何を仮定で埋め、何を聞いたかを報告する**。実装前に AI レビューで懸念・仮定・不確実性を解消したい場合は `/harness-spec-review` を案内する（このスキルからは呼ばない）

統合単位名（unit slug）は kebab-case。引数で渡されたらそれを使う。なければ目的から自分で命名し、保存前にユーザーに確認する。

## project slug の決め方

1 つの project = 1 つの `specs/<project-slug>/` ディレクトリ = 1 本の `feature/<project-slug>` ブランチ = 1 本の main 向け PR。project slug は kebab-case で、後段の harness-coder が feature ブランチ名に直接使う。

引数優先順:

- `<project-slug>/<unit-slug>` 形式で渡された → そのまま採用
- `<project-slug>/<NN>-<unit-slug>` 形式で渡された → `<NN>` も尊重
- unit slug だけ渡された／引数なし → 下記の判定で project を決める

引数で project slug が指定されない場合の判定:

1. `specs/` 配下のサブディレクトリを列挙し、**いずれかの spec が `done` でないもの**（= in-flight project）を集める
2. in-flight project が **1 つだけ** → そこに保存することを 1 行で告げて確定（質問しない）
3. in-flight project が **複数** → `AskUserQuestion` でどの project に属するか聞く。`Other` 経由で新規 project slug を作る選択肢を残す
4. in-flight project が **0** → 目的から project slug を仮命名し、ユーザーに確認したうえで新規 project ディレクトリを作る
5. `harness-hearing` から呼ばれた場合は project slug が必ず渡ってくる前提（hearing 側でロードマップ確定時に決定済み）

`specs/` 直下に `.md` を直接置かない（旧フラット構成は廃止）。すべての spec はいずれかの project ディレクトリに属する。

## 自律確定した仮定の報告

**草案提示（手順 4）と完了報告（手順 6）で、自律確定した非自明な仮定を列挙する**。spec の「仮定 / 不確実性」セクションにも記録する。

- 対象は「複数の妥当な解釈がありえたが自律確定したもの」「明示されていない前提を補ったもの」。変数名・粒度など自明な判断はいちいち挙げなくてよい
- 後で覆ると影響が出る仮定は、何をなぜ仮定したかを一言添える
- エスカレーション基準該当の論点は仮定として処理せず、即時ユーザーに上げる（判定基準: `../harness/risk-criteria.md`）

## ファイル名の番号プレフィックス

spec ファイル名は **`<NN>-<unit-slug>.md`** 形式とする（例: `01-enum-status-convention.md`）。配置先は `specs/<project-slug>/` 配下。

- `<NN>` は **2 桁ゼロパディングの通し番号**（`01`, `02`, ..., `99`）。番号は **PR の実装順 = 依存関係順**を表す（先行する単位ほど小さい番号）
- 依存関係はこの番号順だけで表現する。先行 spec の成果物に乗る場合は、自分より小さい番号に並ぶよう採番すればよい
- **採番は project スコープ**。保存前に既存の `specs/<project-slug>/*.md` をスキャンして最大番号を求め、その **+1** を採番する
  - 例: `specs/play/` に `01-foo.md`, `02-bar.md` があれば次は `03`
  - project ディレクトリが空、または番号付きファイルが無ければ `01` から開始
  - 他 project の番号は無関係
- `/harness-hearing` から連続して複数 spec を作る場合は、計画段階で決まった実装順に従って連番を振る（呼び出し側が `<NN>` を指定してきたら尊重する）
- 引数で `<unit-slug>` のみが渡された場合は AI が番号を採番する。`<project-slug>/<NN>-<unit-slug>` 形式で渡された場合はその番号を尊重する

## テンプレート

この skill ディレクトリの `template.md` を雛形として使う。
**常設 5 セクション + 該当時のみ 3 セクション**。空のセクションを律儀に埋めない（該当しないものは見出しごと省く）。

常設（必ず書く）:

- **frontmatter**（`status`）
- **要約** — 2〜4 行で全体像 + コア受け入れ条件のチェックリスト。読者が 5 秒で要点を掴めること
- **スコープ** — 触る / 触らない
- **受け入れ条件** — 外から観測できる結果。各条件に判定方法（自動 / 振る舞い確認）と観測点を添える
- **失敗時の振る舞い** — エラー経路を持たない PR は「実行時挙動なし」と明記する
- **仮定 / 不確実性**

該当時のみ（無ければセクションごと省く）:

- **契機** — 動線がある場合のみ
- **不変条件 / 禁止** — 守るべき制約がある場合のみ
- **切り戻し** — データ移行・整合性がからむ非自明な場合のみ

## frontmatter

各 spec の冒頭に YAML frontmatter を付ける。`status` は `/harness-coder` が実装ライフサイクルの管理に使う。

```yaml
---
status: pending      # pending | in_progress | done
---
```

- `status` は新規作成時は必ず `pending`。coder が読み込み時に `in_progress` に、PR 作成時に `done` に更新する
- spec 間の依存はファイル名番号 `<NN>` の順序で表現する。spec 以外への参照（既存ファイル・既存パターンなど）は「スコープ」や「仮定 / 不確実性」で言及する

## 注意

- spec は実装内部ではなく**外部から観測できる結果**で書く。**HOW（具体的な数値・ライブラリ・関数名・制御構造）は受け入れ条件に書かない**
  - 例: 「`28ms` ごとに 1 文字描画」「`setTimeout` チェーンで消化」は HOW → spec に書かない。「文字が 1 文字ずつ順に描画される」が WHAT
  - 値そのものが契約（仕様）の場合（例: ステータスコード・API レスポンス形）は WHAT として書いてよい
- 受け入れ条件には判定方法（自動 / 振る舞い確認）と観測点を付ける
- spec を書く過程でエスカレーション基準（`../harness/risk-criteria.md`）に該当する論点が見つかったら、spec 作成を一旦止めてユーザーに上げる
- 「複数の妥当な解釈がある」と気づいた時点で、自律確定せずユーザーに上げる
- 先行 spec の成果物（スキーマ・公開 API 等）に乗る場合は、その spec より大きい番号に採番して実装順を後ろにする。番号順が崩れていると coder が着手時に成立しないと判断する
- 番号順・依存関係はあくまで **同一 project 内**で完結させる。別 project の spec に依存する spec は作らない（project は独立した feature ブランチ＝独立した PR の単位なので、依存関係をまたぐと PR の独立性が崩れる）
