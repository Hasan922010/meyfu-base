/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // CLAUDE.md 20 — rang tizimi
        brand: {
          DEFAULT: '#4f46e5', // indigo
          fg: '#ffffff',
        },
        success: '#16a34a', // kirim / muvaffaqiyat — yashil
        expense: '#ea580c', // xarajat — to'q sariq
        danger: '#dc2626', // xato / qarz — qizil
        pending: '#ca8a04', // kutilmoqda — sariq
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
