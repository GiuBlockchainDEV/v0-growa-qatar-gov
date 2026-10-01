/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type errors now fail the build (the project compiles clean): the old
  // `typescript.ignoreBuildErrors: true` let 33 of them ship unnoticed.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
