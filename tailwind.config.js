/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EBF5FF', 100: '#D6EBFF', 200: '#ADD6FF', 300: '#85C2FF',
          400: '#5CADFF', 500: '#007AFF', 600: '#0062CC', 700: '#004A99',
          800: '#003166', 900: '#001933',
        },
        surface: { DEFAULT: '#FFFFFF', secondary: '#F5F5F7', tertiary: '#E8E8ED' },
        'surface-dark': { DEFAULT: '#1C1C1E', secondary: '#2C2C2E', tertiary: '#3A3A3C' },
        status: {
          success: '#34C759', 'success-bg': '#ECFDF3',
          warning: '#FF9500', 'warning-bg': '#FFFBEB',
          danger: '#FF3B30', 'danger-bg': '#FEF2F2',
          info: '#5AC8FA', 'info-bg': '#EFF6FF',
        },
        text: { primary: '#1D1D1F', secondary: '#6E6E73', tertiary: '#AEAEB2', inverse: '#FFFFFF' },
        'text-dark': { primary: '#F5F5F7', secondary: '#98989D', tertiary: '#636366' },
        border: { DEFAULT: '#D2D2D7', light: '#E5E5EA', dark: '#38383A' },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: { 'apple': '10px', 'apple-lg': '14px', 'apple-xl': '20px' },
      boxShadow: {
        'apple-sm': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'apple': '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'apple-md': '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'apple-lg': '0 8px 32px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideIn: { '0%': { transform: 'translateX(-8px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};
