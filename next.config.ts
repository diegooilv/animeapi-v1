import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'cdn.myanimelist.net' }
        ],
    },
};

export default nextConfig;