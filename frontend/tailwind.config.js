/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: ['DM Sans', 'Manrope', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  			display: ['Space Grotesk', 'sans-serif']
  		},
  		colors: {
  			/* new token-driven system — see src/styles/tokens.css.
  			   Use these for anything new: bg-surface-1, text-primary, text-brand, etc. */
  			surface: {
  				0: 'var(--surface-0)',
  				1: 'var(--surface-1)',
  				2: 'var(--surface-2)',
  				3: 'var(--surface-3)'
  			},
  			ink: {
  				DEFAULT: 'var(--text-primary)',
  				secondary: 'var(--text-secondary)',
  				muted: 'var(--text-muted)',
  				inverse: 'var(--text-inverse)'
  			},
  			hair: {
  				DEFAULT: 'var(--hairline)',
  				strong: 'var(--hairline-strong)'
  			},
  			brand: {
  				DEFAULT: 'var(--brand)',
  				dim: 'var(--brand-dim)',
  				hover: 'var(--brand-hover)',
  				on: 'var(--on-brand)'
  			},
  			info: {
  				DEFAULT: 'var(--blue)',
  				dim: 'var(--blue-dim)'
  			},
  			success: {
  				DEFAULT: 'var(--green)',
  				dim: 'var(--green-dim)'
  			},
  			warn: {
  				DEFAULT: 'var(--orange)',
  				dim: 'var(--orange-dim)'
  			},
  			danger: {
  				DEFAULT: 'var(--red)',
  				dim: 'var(--red-dim)'
  			},
  			/* legacy shadcn tokens — still used by existing components/ui/* primitives */
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};