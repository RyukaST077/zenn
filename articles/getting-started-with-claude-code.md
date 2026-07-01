---
title: "ZennとGitHubを連携してpushで記事を自動公開する"
emoji: "🚀"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["zenn", "github"]
published: true
---

## やりたいこと

Zennの記事はGitHubリポジトリと連携すると、`main`ブランチにpushするだけで自動的に公開・更新されます。CLIでいちいち投稿操作をする必要がなく、`git push`だけで記事管理が完結するので便利です。

## 連携方法

1. [Zennのダッシュボード](https://zenn.dev/dashboard/deploys) にアクセスする
2. 「GitHubリポジトリと連携する」から対象のリポジトリを選択する
3. 連携が完了すると、リポジトリの`articles/`配下にある記事がpush時に自動でデプロイされる

## 記事の書き方

`zenn-cli`を使うとローカルで記事の作成・プレビューができます。

```bash
npx zenn new:article --slug my-article --title "タイトル" --type tech --emoji "🚀"
npx zenn preview
```

作成した記事のFront Matterで`published: true`にしてpushすると、Zenn上に公開されます。

## まとめ

- Zenn連携はGitHub Actionsなどを自作する必要はなく、Zenn側のGitHub連携機能だけで完結する
- `articles/*.md`を編集して`git push`するだけで公開・更新ができる
