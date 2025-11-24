/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Outfit', 'Google Sans', 'sans-serif'],
                stack: ['"Stack Sans Notch"', 'sans-serif'],
                bebas: ['"Bebas Neue"', 'sans-serif'],
                rubik: ['Rubik', 'sans-serif'],
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out forwards',
            },
        },
    },
    plugins: [],
}
