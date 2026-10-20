/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#102b3a",
        teal: "#087d4d",
        paper: "#f7f9f7",
      },
      boxShadow: {
        card: "0 12px 35px rgba(16, 43, 58, 0.07)",
      },
    },
  },
  plugins: [],
};
