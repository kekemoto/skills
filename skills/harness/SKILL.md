---
name: harness
description: Entry point for the AI-driven dev flow. Inspects the repo + specs/ state and the user's input, decides which harness stage to run now (elicit requirements → write specs → execute the backlog), and delegates to harness-hearing / harness-spec to write specs — then STOPS so the user can review the spec files. Runs harness-coder only when the user explicitly asks to implement (or re-invokes /harness against an already-reviewed backlog); never auto-chains hearing → coder. Use when the user runs /harness, gives a development goal without picking a sub-skill, or just says "continue / what's next". Invoke explicitly only.
---

harness フローの**単一入口**。リポジトリと `specs/` の状態、ユーザー入力を見て「いまやるべき段階」を判断し、適切な harness-* に委譲する。
**ヒアリング/spec 作成と実装の間には必ずユーザーのレビューを挟む** — spec を作り終えたら停止し、ユーザーが spec を確認してから実装を明示的に指示する運用。
**明示起動専用**。

## project 単位の並列性

1 つの「目的」= 1 つの **project** = 1 つの `specs/<project-slug>/` ディレクトリ = 1 本の `feature/<project-slug>` ブランチ = 1 本の main 向け PR。複数 project を**並列に**抱えてよい（in-flight な project が複数あってもよい）。
ただしオーケストレータは **1 回の起動で 1 project だけ**を対象に判断・委譲する。複数 project が候補になる場面では `AskUserQuestion` でどの project を進めるか確定してから委譲する。

## このスキルの役割

- 状態を見て **どの段階から始めるか**を判断する（ヒアリング / spec 1 本追加 / 既存 spec の実装 / 何もない）
- 判断した段階の harness-* を **Skill ツールで呼ぶ**。ただし **spec 作成（ヒアリング/spec）の後は自動で実装へ進まず停止する**（ユーザーの spec レビューを挟む）
- **自分では分解・spec 作成・実装をしない**。すべて専門スキルに委譲する。orchestrator は状態判断と段階制御だけを担う
- エスカレーション基準該当・本質的な曖昧さだけユーザーに上げ、それ以外は自律で前進する

## 委譲先スキル

| スキル | 役割 |
| ---------------- | ------------------------------------------------------ |
| `harness-hearing` | 大きい/曖昧な目的 → ヒアリング → spec 群を `specs/<project-slug>/` に作成 |
| `harness-spec`    | 1 PR で収まる明確な変更の spec を 1 本作成（`specs/<project-slug>/<NN>-<unit>.md`） |
| `harness-spec-review` | 単一 project の spec 群を実装着手前にレビューし、懸念・仮定・不確実性を解消して spec に書き戻す |
| `harness-coder` | 単一 project の spec 群を番号順に実装し feature→main PR まで |
| `AskUserQuestion` | idle 時の意図確認・方針が割れたときの選択肢提示          |

エスカレーション要否の判定は別スキルに切らず、各 harness-* スキルがそれぞれインラインで `risk-criteria.md`（この skill ディレクトリ同梱。他の harness-* skill からは `../harness/risk-criteria.md`）を参照して行う。

## 状態の把握（最初に必ず行う）

委譲先を決める前に、以下を短く確認する。

1. **ユーザー入力**: 新しい目的/要件か / 「続き」「進めて」等の継続指示か / 空（指示なし起動）か。明示的に project slug を指定していないか
2. **`specs/` の状態**: サブディレクトリを列挙し、各 project ごとに spec の `pending` / `in_progress` / `done` 本数を数える。**in-flight な project**（= `done` でない spec を含むもの）の slug を一覧化する。`specs/` 直下に `.md` が直接置かれている旧構成があれば、ユーザーに整理を促す（このスキルでは触らない）
3. **git の状態**: 現在ブランチ / 作業ツリーが clean か / `feature/*` ブランチの有無と slug。`feature/<slug>` と in-flight な `specs/<slug>/` の対応を取る（slug が一致するペアが「実行途中」サイン）

## 判断ロジック（上から順に評価し、最初に当てはまった段階へ）

1. **実行途中の resume**: `feature/<slug>` ブランチがあり、対応する `specs/<slug>/` に未完（pending / in_progress）の spec が残っている → その slug を引数として `harness-coder` を resume で実行する。**複数該当**するときは `AskUserQuestion` でどの project を再開するか選ばせる（ユーザーが無関係な新目的を出していない限り）
2. **新しい目的があり、対応する spec がまだ無い**:
   - 大きい / 曖昧 / 複数モジュールや複数 PR に分かれそう → `harness-hearing` を呼ぶ（新規 project が作られる）
   - 明確に 1 PR・1 責務で収まる → `harness-spec` を呼ぶ（既存 in-flight project に足すか、新規 project を作るかは下位スキルの判定に委ねる）
   - **どちらの場合も、spec を作り終えたら作成した spec 群を提示して停止する**。同じ実行内でステップ 3（実装）へは進まない。実装はユーザーが spec をレビューしたうえで明示的に指示する
3. **未実装の spec がある（pending / in_progress）**: `harness-coder` を呼んで実装する。**in-flight project が複数**ある場合は `AskUserQuestion` でどの project を進めるか確定してから委譲する（ユーザー入力で slug が指定されていればそれを尊重）。着手前のロードマップ提示と feature ブランチ名確認は coder 内のゲートが行う
   - この段階に来るのは、**新規 spec 作成を伴わない起動**（= ユーザーが既存のレビュー済み spec の実装を求めて `/harness` を起動した、またはステップ 1 の resume）の場合。直前にこの実行でヒアリング/spec を行ったときは、ここへは進まずステップ 2 の末尾で停止している
4. **spec も目的も無い**: 何をしたいかをユーザーに尋ねて終わる（idle。勝手に作業を始めない）

判断に迷う場合（どの段階か曖昧・目的の解釈が割れる）は、**推定した方針を 1〜2 行で示してから**進む。`risk-criteria.md` の Danger ゾーン／ゾーンに依らず止める論点に該当するなら止めて上げる。

## 段階間の停止（spec レビューゲート）

- **ヒアリング / spec 作成が終わったら、`harness-coder` へは自動で進まず停止する**。作成した spec 群を一覧で提示し、ユーザーが spec ファイルを確認・修正できる状態にする。「次は実装しますか」とも訊かない（勝手に coder を呼ばない）
- 停止時に **`/harness-spec-review` で実装前レビュー（懸念・仮定・不確実性の解消）ができる**ことを案内に添える。ただし自動では呼ばない（推奨提示のみ。実行はユーザーの明示起動）
- 実装に入るのは、ユーザーが spec をレビューしたうえで **明示的に指示したとき**に限る。次のいずれか:
  - ユーザーが `/harness-coder` を直接実行する
  - ユーザーが（spec をレビュー後）改めて `/harness` を起動する → pending spec が既にあるのでステップ 3 で coder に入る
- 各段階に入る前に「いま何を判断し、次にどのスキルを呼ぶか」を 1〜2 行報告してから委譲する
- 各委譲先スキルの停止条件・ゲートを尊重する。orchestrator がそれらを上書きしない
- 次の場合も当然止まる:
  - `risk-criteria.md` の 🔴 Danger / 「ゾーンに依らず止める論点」に該当
  - 本質的な曖昧さ（複数の妥当な解釈があり優劣を AI が決められない）
  - ユーザーが「計画だけ」「spec だけ」と明示した
  - `harness-coder` の統合検証が落ちた

## 注意

- orchestrator 自身は **git 操作・コミット・実装をしない**。feature ブランチ作成〜PR 作成は `harness-coder` の責務（AI は main を触らず、feature→main マージは人間、という下位スキルの原則をそのまま尊重する）
- ユーザーが特定スキル（例: `/harness-coder` を直接）を呼びたいと明示した場合は、その指定を優先し、orchestrator は介在しない
- バックログが大きく 1 会話の文脈が重くなりそうなら、`harness-coder` に範囲指定（番号範囲）を渡して分割実行するよう促す
