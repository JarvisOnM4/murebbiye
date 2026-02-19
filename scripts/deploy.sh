#!/usr/bin/env bash
set -euo pipefail

echo "=== Murebbiye Infrastructure Deploy ==="
echo ""

# Check prerequisites
command -v aws >/dev/null 2>&1 || { echo "ERROR: AWS CLI not found. Install: https://aws.amazon.com/cli/"; exit 1; }
command -v cdk >/dev/null 2>&1 || { echo "ERROR: AWS CDK not found. Install: npm install -g aws-cdk"; exit 1; }

# Verify AWS credentials
aws sts get-caller-identity >/dev/null 2>&1 || { echo "ERROR: AWS credentials not configured. Run: aws configure"; exit 1; }

echo "1. Installing CDK dependencies..."
cd infra && npm install && cd ..

echo "2. Synthesizing CloudFormation template..."
cd infra && npx cdk synth && cd ..

echo "3. Deploying infrastructure..."
cd infra && npx cdk deploy --require-approval broadening && cd ..

echo ""
echo "=== Deploy Complete ==="
echo ""
echo "Next steps:"
echo "1. Retrieve DB password: aws secretsmanager get-secret-value --secret-id <DatabaseSecretArn>"
echo "2. Retrieve IAM secret key: aws secretsmanager get-secret-value --secret-id <IamSecretKeyArn>"
echo "3. Set Vercel environment variables (see docs/setup-guide.md)"
echo "4. Run Prisma migration: DATABASE_URL=<connection-string> npx prisma migrate deploy"
echo "5. Seed the database: DATABASE_URL=<connection-string> npx tsx prisma/seed.ts"
