// https://nuxt.com/docs/api/configuration/nuxt-config
const isStaging = (process.env.ENVIRONMENT || "staging") === "staging"

function env(name: string) {
  const key = isStaging ? `STAGING_${name}` : name
  return process.env[key] || process.env[name] || ""
}

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  app: {
    head: {
      title: "KapeDoko",
      meta: [
        { name: "theme-color", content: "#1F6F6B" },
      ],
      link: [
        { rel: "icon", href: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg", sizes: "any" },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
        { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "mask-icon", href: "/favicon.svg", color: "#1F6F6B" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Kumbh+Sans:wght,YOPQ@100..900,300&display=swap",
        },
      ],
    },
  },
  modules: [
    "@nuxtjs/ionic",
    "@nuxtjs/tailwindcss",
    "shadcn-nuxt",
    "@nuxtjs/supabase",
    "@nuxt/image",
  ],
  css: ["~/assets/css/ionic.css", "~/assets/css/tailwind.css"],
  ionic: {
    css: {
      core: false,
      basic: false,
      utilities: false,
    },
  },
  tailwindcss: {
    cssPath: "~/assets/css/tailwind.css",
  },
  shadcn: {
    prefix: "Ui",
    componentDir: "./app/components/ui",
  },
  supabase: {
    url: env("SUPABASE_URL"),
    key: env("SUPABASE_KEY"),
    redirect: false,
    useSsrCookies: process.env.NUXT_PUBLIC_AUTH_STORAGE !== "local",
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 400,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    clientOptions: {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    },
    redirectOptions: {
      login: "/login",
      callback: "/confirm",
      exclude: ["/**"],
      saveRedirectToCookie: false,
    },
  },
  routeRules: {
    "/favicon.ico": {
      headers: {
        "content-type": "image/x-icon",
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
    "/favicon.svg": {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
    "/favicon-32x32.png": {
      headers: {
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
    "/favicon-16x16.png": {
      headers: {
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
    "/apple-touch-icon.png": {
      headers: {
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  },
  runtimeConfig: {
    postgresUrl: env("POSTGRES_URL"),
    posthogPersonalApiKey: env("POSTHOG_PERSONAL_API_KEY"),
    public: {
      environment: isStaging ? "staging" : "production",
      mapTiles: {
        url:
          process.env.NUXT_PUBLIC_MAP_TILE_URL ||
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          process.env.NUXT_PUBLIC_MAP_ATTRIBUTION ||
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
      r2PublicBaseUrl: env("NUXT_PUBLIC_R2_PUBLIC_BASE_URL"),
      analytics: {
        enabled: env("NUXT_PUBLIC_ANALYTICS_ENABLED") === "true",
        key: env("NUXT_PUBLIC_POSTHOG_KEY"),
        host: process.env.NUXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
        appVersion: process.env.NUXT_PUBLIC_APP_VERSION || "1.0.0",
      },
    },
  },
});
