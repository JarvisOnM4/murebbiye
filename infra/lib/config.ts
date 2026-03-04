export const config = {
  projectName: "murebbiye",
  region: "us-east-1",
  db: {
    instanceClass: "db.t4g.micro",
    allocatedStorage: 20,
    maxAllocatedStorage: 100,
    databaseName: "murebbiye",
    backupRetention: 7,
  },
  s3: {
    bucketName: "murebbiye-curriculum",
  },
  bedrock: {
    modelArns: [
      "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-haiku-*",
      "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-*",
      "arn:aws:bedrock:*:936197736978:inference-profile/us.anthropic.claude-*",
    ],
  },
};
