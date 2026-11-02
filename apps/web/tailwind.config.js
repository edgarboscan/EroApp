/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#007BFF',
          dark: '#3D91FF',
          hover: '#0069d9',
          'hover-dark': '#297be6',
        },
        secondary: {
          DEFAULT: '#17A2B8',
          dark: '#38C9DD',
          hover: '#138496',
          'hover-dark': '#26b3c7',
        },
        success: {
          DEFAULT: '#28A745',
          dark: '#4ADE80',
        },
        warning: {
          DEFAULT: '#FFC107',
          dark: '#FBBF24',
        },
        app: {
          text: '#333333',
          'text-dark': '#E0E0E0',
          bg: '#F4F6F9',
          'bg-dark': '#242526',
          card: '#FFFFFF',
          'card-dark': '#1E1F21',
          border: '#E5E7EB',
          'border-dark': '#374151',
        },
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#007BFF',
          600: '#0069d9',
          700: '#0056b3',
        },
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [],
};
