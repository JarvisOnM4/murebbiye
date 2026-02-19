import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "@aws-sdk/client-bedrock-runtime",
    "@aws-sdk/client-s3",
  ],
};

export default nextConfig;
