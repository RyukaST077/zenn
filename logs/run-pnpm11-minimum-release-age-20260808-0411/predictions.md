# 検証前に固定した予測（フェーズ1 / 検証を1回も走らせる前に書いた）

固定時刻: 2026-08-07T19:12Z (JST 2026-08-08 04:12)

- 予測① pnpm 11 で「公開24時間以内のバージョン」を exact 指定すると install が失敗する（ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION が出る）
- 予測② `.npmrc` に `minimum-release-age=0` を書けば制限が緩む
- 予測③ 同じ exact 指定を pnpm 10.13.1 で実行すると成功する
