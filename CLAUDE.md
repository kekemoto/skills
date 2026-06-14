# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## このリポジトリの性質

Claude Code 向けの個人用 Agent Skills 集。**コードではなく `SKILL.md`（Markdown + YAML frontmatter）の集合**であり、ビルド・テスト・lint の仕組みは無い。各スキルは `skills/<skill-name>/SKILL.md` に置く。frontmatter の `name` / `description` がスキルの起動判定に使われるため、編集時はここの正確さが最重要。

スキルを変更したときの「検証」は、コマンド実行ではなく **frontmatter の description が起動条件を正しく表現しているか / 本文中のスキル間参照（`/harness-coder` など）と相対パス（`../harness/risk-criteria.md`）が実在するか**を読み合わせること。

**スキルを追加したら必ず `README.md` も更新する**（「スキル一覧」表に追記。独立系スキルなら「独立系スキル」表にも追記）。スキルの追加と README の更新は同一の変更としてセットで扱う。

## 中核アーキテクチャ: harness フロー

`harness-*` 5 スキルが、要件定義 → spec 作成 → レビュー → 実装までの AI 駆動開発フローを構成する。複数ファイルにまたがる設計なので、1 つを編集するときは関連スキルの整合も確認する。

```
/harness (オーケストレータ: 状態を見て段階を判断・委譲。自分では作業しない)
   ├─ harness-hearing      大きい/曖昧な目的 → ヒアリング → spec 群を作成
   ├─ harness-spec         1 PR で収まる明確な変更の spec を 1 本作成
   ├─ harness-spec-review  実装前に spec 群をレビューし懸念を spec へ書き戻す
   └─ harness-coder        spec 群を番号順に実装し feature→main PR まで
```

このフローを貫く設計上の不変条件（スキルを編集してもこれらを壊さない）:

- **project = 1 つの `specs/<project-slug>/` ディレクトリ = 1 本の `feature/<project-slug>` ブランチ = 1 本の main 向け PR**。この 3 つの slug は同一文字列で、project の同一性・resume・PR 紐付けの根拠になる。
- **spec レビューゲート**: spec 作成（hearing/spec）と実装（coder）の間で必ず停止し、ユーザーのレビューを挟む。`/harness` は hearing → coder を自動連鎖させない。各スキルは自分から `/harness-coder` を呼ばない。
- **AI は main を絶対に触らない**。coder は feature ブランチに各 spec を 1 commit ずつ積み、最後に feature→main PR を作るだけ。**マージは人間の役割**。
- **spec は WHAT で書く**。「何が成り立てば完了か（外から観測できる結果）」を書き、HOW（具体的な数値・ライブラリ・関数名・制御構造）は書かない。雛形は `skills/harness-spec/template.md`。
- **エスカレーション判定の正本は `skills/harness/risk-criteria.md`**。全 harness スキルが（専用スキルに切らず）インラインでこれを参照し、🔴 Danger / 🟡 Caution / 🟢 Free のゾーンで「止めるか・自律で進めるか」を決める。判定は**置き場所ではなく振る舞い**で行い、迷ったら上位ゾーンに倒す。

### spec ファイルの規約

- パス: `specs/<project-slug>/<NN>-<unit-slug>.md`（`specs/` 直下に `.md` を直接置かない）。
- `<NN>` は project 内で 2 桁ゼロパディングの通し番号。**番号順 = 実装順 = 依存順**（先行する単位ほど小さい番号）。依存はこの番号順だけで表現し、別 project の spec に依存させない。
- frontmatter `status: pending | in_progress | done` でライフサイクルを管理。新規は必ず `pending`、coder が読込時に `in_progress`、PR 作成時に `done` に更新する。

### ask / assume / escalate の判断軸（hearing / spec-review の肝）

曖昧さを「AI が推定を作れるか」ではなく **「その推定が外れたときの手戻りの広がり」** で振り分ける。局所（1 spec 内で直せる）→ assume、横断（複数 spec の再分解に波及）→ ask、リスクゾーン該当 → escalate。

## 独立系スキル

harness フローとは独立に単体で使うユーティリティ。

- **diff-summary** (`/diff-summary`): 実装後の変更サマリを auditability 重視の定型フォーマットで出力。「テストでカバーしていない範囲」「自信のない箇所・懸念」を空欄にさせないのが要点（coder のコミットメッセージ規約と同じ思想）。
- **walkthrough** (`/walkthrough`): 長い文書を数行ずつ区切り、毎回「ここまでOK？」と確認を取りながら解説する。確認前に次へ進まない。

## 執筆上の注意

- 既存スキルの本文は日本語、frontmatter の `description` は英語で書かれている。新規・編集時もこの慣習に合わせる。
- スキル間参照はスキル名（`/harness-coder`）か、ファイル相対パス（`../harness/risk-criteria.md`）で行う。リネーム時は参照元すべてを追従させる。
