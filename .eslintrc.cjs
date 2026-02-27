module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    
    // WCAG Compliance Rule: Ban sub-12px typography
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/text-\\[(9|10|11)px\\]/]',
        message: '❌ WCAG Violation: Use text-xs (12px) minimum. Sub-12px text fails accessibility standards. Replace with: text-xs, text-sm, or text-base.',
      },
      {
        selector: 'Literal[value=/text-\\[9px\\]/]',
        message: '❌ WCAG Critical: text-[9px] is below minimum readable size. Use text-xs (12px) instead.',
      },
      {
        selector: 'Literal[value=/text-\\[10px\\]/]',
        message: '❌ WCAG Critical: text-[10px] is below minimum readable size. Use text-xs (12px) instead.',
      },
      {
        selector: 'Literal[value=/text-\\[11px\\]/]',
        message: '❌ WCAG Critical: text-[11px] is below minimum readable size. Use text-xs (12px) instead.',
      },
    ],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
}
