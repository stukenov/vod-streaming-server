/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://api.vod.31kz.adapto.kz/:path*' // URL вашего бэкенда
      }
    ]
  }
}

export default nextConfig
