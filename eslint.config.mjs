import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      "prisma/migrations/**",
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
    ],
  },
];
