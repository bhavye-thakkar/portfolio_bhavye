export type TagVariant =
  | "three"
  | "websockets"
  | "react"
  | "redis"
  | "gray"
  | "html"
  | "css"
  | "javascript"
  | "node"
  | "next"
  | "kubernetes"
  | "postgresql"
  | "flutter"
  | "ogl"
  | "glsl"
  | "python"
  | "qt"
  | "fastapi"
  | "sqlite";

export const tagLabels = {
  three: "Three.js",
  websockets: "WebSockets",
  react: "React",
  redis: "Redis",
  gray: "Gray",
  html: "HTML",
  css: "CSS",
  javascript: "JavaScript",
  node: "Node.js",
  next: "Next.js",
  kubernetes: "Kubernetes",
  postgresql: "PostgreSQL",
  flutter: "Flutter",
  ogl: "OGL.js",
  glsl: "GLSL",
  python: "Python",
  qt: "Qt",
  fastapi: "FastAPI",
  sqlite: "SQLite",
} as const satisfies Record<TagVariant, string>;
