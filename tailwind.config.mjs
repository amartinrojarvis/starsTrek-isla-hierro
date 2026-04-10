/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: '#0a0a0a',
        secondary: '#0f172a',
        accent: '#3b82f6',
        gold: '#fbbf24',
        starlight: '#60a5fa',
        cosmic: '#0f172a',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shoot': 'shoot 3s ease-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shoot: {
          '0%': { transform: 'translateX(0) translateY(0) rotate(-45deg)', opacity: '1' },
          '100%': { transform: 'translateX(300px) translateY(300px) rotate(-45deg)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
