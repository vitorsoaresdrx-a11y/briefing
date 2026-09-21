import { Anton, Instrument_Sans, JetBrains_Mono } from "next/font/google";

// Display (headlines): Neuhaus Headline (condensada, caixa alta) é a fonte
// oficial. Enquanto o arquivo não for fornecido, usamos Anton como fallback
// (mesma proporção condensada).
//
// Para trocar pela Neuhaus, solte o arquivo em `src/fonts/NeuhausHeadline.woff2`
// e troque UMA linha aqui: substitua o `displayFont` abaixo por:
//
//   import localFont from "next/font/local";
//   export const displayFont = localFont({
//     src: "../fonts/NeuhausHeadline.woff2",
//     variable: "--font-display",
//     display: "swap",
//   });
export const displayFont = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const sansFont = Instrument_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const monoFont = JetBrains_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
