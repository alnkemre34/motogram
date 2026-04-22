import type { Config } from 'tailwindcss';

// Spec 9.1 - NFS tarzi koyu tema: siyah/koyu gri zemin + altin sari/turuncu vurgu.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Motogram palet (Spec 9.1)
        background: '#0b0b10',
        surface: '#14141c',
        surfaceHover: '#1c1c26',
        border: '#2a2a36',
        text: '#f4f4f5',
        textMuted: '#9ca3af',
        accent: '#f59e0b', // amber-500 (altin sari)
        accentDanger: '#ef4444',
        accentSuccess: '#22c55e',
        accentInfo: '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
