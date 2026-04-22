/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['./base.js', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  plugins: ['react', 'react-hooks', 'react-native'],
  env: {
    'react-native/react-native': true,
    jest: true,
  },
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react-native/no-raw-text': 'off',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-single-element-style-arrays': 'warn',
    // Spec 9.6 - hardcoded string yasak (i18next zorunlu)
    'react-native/no-raw-text': ['off'],
  },
};
