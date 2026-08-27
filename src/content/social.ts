export const social = [
  { url: "mailto:hello@example.com", name: "mail" },
  { url: "https://github.com/example", name: "github" },
  { url: "https://www.linkedin.com/in/example/", name: "linkedin" },
  { url: "https://x.com/example", name: "x" },
  //{ url: "https://www.instagram.com/example/", name: "instagram" },
] as const satisfies { url: string; name: "mail" | "github" | "instagram" | "linkedin" | "x" }[];
