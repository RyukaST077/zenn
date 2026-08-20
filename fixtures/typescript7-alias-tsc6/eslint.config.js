// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['gen.mjs', 'eslint.config.js', 'npm-cache/**', 'node_modules/**', 'shot.mjs'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
