import type { NextConfig } from 'next';
import path from 'node:path';

const distDir = process.env.NEXT_DIST_DIR;
const skipBuildChecks = process.env.LIGHTHOUSE_SKIP_BUILD_CHECKS === '1';
const useLighthouseWorkerConfig = process.env.LIGHTHOUSE_FORCE_SINGLE_WORKER === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(distDir ? { distDir } : {}),
  ...(useLighthouseWorkerConfig
    ? {
        experimental: {
          cpus: 1,
          workerThreads: true,
        },
      }
    : {}),
  ...(skipBuildChecks
    ? {
        typescript: { ignoreBuildErrors: true },
      }
    : {}),
  outputFileTracingRoot: path.resolve(__dirname),
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

export default nextConfig;
