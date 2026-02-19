#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MurebbiyeStack } from "../lib/murebbiye-stack";
import { config } from "../lib/config";

const app = new cdk.App();
new MurebbiyeStack(app, "MurebbiyeStack", {
  env: {
    // Vpc.fromLookup requires a concrete account + region at synth time.
    // CDK_DEFAULT_ACCOUNT / CDK_DEFAULT_REGION are set automatically by
    // the CDK CLI based on the active AWS profile / credentials.
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: config.region,
  },
  description: "Murebbiye educational platform infrastructure",
});
