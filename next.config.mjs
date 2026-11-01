/** @type {import('next').NextConfig} */
const nextConfig = {
  // The ocean pathfinder reads its MIT-licensed bundled ocean-grid binary at runtime.
  serverExternalPackages: ['@arcnautical/maritime-routing'],
  // Serverless output tracing must include the binary sea/land grid loaded
  // dynamically by the external pathfinder; otherwise it works in CI and
  // silently yields N/A in Vercel runtime.
  outputFileTracingIncludes: {
    '/api/nfii/logistics/corridors': [
      './node_modules/@arcnautical/maritime-routing/data/ocean-grid.bin.gz',
    ],
  },
  // Type errors now fail the build (the project compiles clean): the old
  // `typescript.ignoreBuildErrors: true` let 33 of them ship unnoticed.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
