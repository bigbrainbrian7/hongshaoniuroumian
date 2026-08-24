/** @type {import('next').NextConfig} */
const apiOrigin = process.env.EC2_API_ORIGIN?.replace(/\/$/, '')

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    if (!apiOrigin) return []

    return [
      {
        source: '/dashboard-api/:path*',
        destination: `${apiOrigin}/:path*`,
      },
    ]
  },
}

export default nextConfig
