# skills

自分用の Agent Skills 集（SKILL.md 形式 / Claude Code 向け）。
各スキルは `skills/<skill-name>/SKILL.md` に置く。

## harness フロー

要件定義から実装・PR 作成までを担う AI 駆動開発フロー。5 つのスキルで構成される。

```
/harness（オーケストレータ）
  ├─ /harness-hearing      大きい/曖昧な目的 → ヒアリング → spec 群を作成
  ├─ /harness-spec         1 PR で収まる変更の spec を 1 本作成
  ├─ /harness-spec-review  実装前に spec 群をレビューし懸念を解消・spec に書き戻す
  └─ /harness-coder        spec 群を番号順に実装し feature→main PR を作成
```

### 使い方

1. `/harness <目的>` で起動 → オーケストレータが状態を見て適切な段階に委譲
2. spec が作成されたら**一旦停止**。ユーザーが spec を確認する
3. 問題なければ `/harness-coder` で実装開始
4. AI は feature ブランチにコミットし、feature→main PR を作成して停止
5. **マージはユーザーが行う**

### project の単位

1 つの目的 = 1 つの `specs/<project-slug>/` = 1 本の `feature/<project-slug>` ブランチ = 1 本の main 向け PR。slug は 3 者で同一。

### spec の規約

- パス: `specs/<project-slug>/<NN>-<unit-slug>.md`
- `<NN>` は 2 桁ゼロパディングの通し番号（番号順 = 実装順 = 依存順）
- frontmatter `status`: `pending` → `in_progress` → `done`
- 内容は **WHAT**（何が成り立てば完了か）で書く。HOW（実装詳細）は書かない

## 独立系スキル

harness フローとは独立して単体で使うユーティリティ。

| スキル | 起動コマンド | 概要 |
|---|---|---|
| diff-summary | `/diff-summary` | 実装後の変更サマリを auditability 重視の定型フォーマットで出力 |
| walkthrough | `/walkthrough` | 長い文書を数行ずつ区切り、確認を取りながら解説 |

## スキル一覧

| スキル | 概要 |
|---|---|
| `harness` | フローの単一入口。状態を見て段階を判断し harness-* に委譲する |
| `harness-hearing` | 大きい/曖昧な目的をヒアリングで分解し spec 群を作成 |
| `harness-spec` | 明確な変更の spec を 1 本作成して `specs/` に保存 |
| `harness-spec-review` | 実装前に spec 群をレビューし懸念・仮定・不確実性を解消 |
| `harness-coder` | spec 群を番号順に実装し feature→main PR を作成 |
| `diff-summary` | 変更差分を意図・設計判断・懸念ベースで構造化して報告 |
| `walkthrough` | 長い文書を段階的に確認を取りながら解説 |
