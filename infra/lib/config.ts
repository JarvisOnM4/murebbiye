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
    modelArn: "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0",
  },
};
