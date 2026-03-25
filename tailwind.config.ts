import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        giro: {
          fogo: '#830200',
          laranja: '#E05300',
          'laranja-light': '#FF8C00',
          'grey-light': '#DADADA',
          'grey-neutral': '#8A8589',
        }
      },
      backgroundImage: {
        'giro-gradient': 'linear-gradient(135deg, #830200 0%, #E05300 50%, #FF8C00 100%)',
      },
      fontFamily: {
        giro: ['GIRO Sans', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

export default config