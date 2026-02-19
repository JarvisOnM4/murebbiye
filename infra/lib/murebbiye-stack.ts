import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { config } from "./config";

export class MurebbiyeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------
    // S3 Bucket — Curriculum file storage
    // ---------------------------------------------------------------
    const curriculumBucket = new s3.Bucket(this, "CurriculumBucket", {
      bucketName: config.s3.bucketName,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedOrigins: [
            "https://murebbiye.org",
            "https://*.vercel.app",
          ],
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.GET,
          ],
          allowedHeaders: ["*"],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
    });

    // ---------------------------------------------------------------
    // RDS PostgreSQL 16 — Primary database
    // ---------------------------------------------------------------

    // Parameter group to enforce SSL connections
    const parameterGroup = new rds.ParameterGroup(this, "DbParameterGroup", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      description: "Murebbiye PostgreSQL 16 parameter group — SSL enforced",
      parameters: {
        "rds.force_ssl": "1",
      },
    });

    // Use the account's default VPC (no custom VPC needed for this setup).
    const defaultVpc = ec2.Vpc.fromLookup(this, "DefaultVpc", {
      isDefault: true,
    });

    // Security group: allow PostgreSQL traffic from anywhere (Vercel has
    // dynamic IPs, so we cannot restrict to a fixed CIDR). The RDS instance
    // itself enforces SSL, and the master password is generated and stored
    // in Secrets Manager, which together provide the trust boundary.
    const dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc: defaultVpc,
      description: "Allow PostgreSQL access from Vercel (public internet)",
      allowAllOutbound: true,
    });
    dbSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      "Allow PostgreSQL from anywhere (Vercel dynamic IPs)"
    );

    const dbInstance = new rds.DatabaseInstance(this, "Database", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      vpc: defaultVpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO
      ),
      databaseName: config.db.databaseName,
      credentials: rds.Credentials.fromGeneratedSecret("murebbiye_admin", {
        secretName: `${config.projectName}/db-credentials`,
      }),
      parameterGroup,
      allocatedStorage: config.db.allocatedStorage,
      maxAllocatedStorage: config.db.maxAllocatedStorage,
      storageType: rds.StorageType.GP3,
      publiclyAccessible: true,
      securityGroups: [dbSecurityGroup],
      multiAz: false,
      backupRetention: cdk.Duration.days(config.db.backupRetention),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // ---------------------------------------------------------------
    // IAM User — Application credentials for Bedrock + S3
    // ---------------------------------------------------------------
    const appUser = new iam.User(this, "AppUser", {
      userName: `${config.projectName}-app`,
    });

    // Policy: invoke Bedrock Claude Haiku model
    appUser.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowBedrockInvoke",
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: [config.bedrock.modelArn],
      })
    );

    // Policy: CRUD objects in the curriculum bucket
    appUser.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowS3CurriculumAccess",
        effect: iam.Effect.ALLOW,
        actions: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
        resources: [curriculumBucket.arnForObjects("*")],
      })
    );

    // Create access key and store the secret in Secrets Manager
    const accessKey = new iam.AccessKey(this, "AppUserAccessKey", {
      user: appUser,
    });

    const accessKeySecret = new secretsmanager.Secret(
      this,
      "AppUserSecretKey",
      {
        secretName: `${config.projectName}/iam-secret-key`,
        description: "IAM secret access key for the murebbiye-app user",
        secretStringValue: accessKey.secretAccessKey,
      }
    );

    // ---------------------------------------------------------------
    // Stack Outputs
    // ---------------------------------------------------------------
    new cdk.CfnOutput(this, "DatabaseEndpoint", {
      value: dbInstance.dbInstanceEndpointAddress,
      description: "RDS PostgreSQL endpoint hostname",
    });

    new cdk.CfnOutput(this, "DatabasePort", {
      value: dbInstance.dbInstanceEndpointPort,
      description: "RDS PostgreSQL port",
    });

    new cdk.CfnOutput(this, "DatabaseSecretArn", {
      value: dbInstance.secret?.secretArn ?? "N/A",
      description: "Secrets Manager ARN for DB credentials",
    });

    new cdk.CfnOutput(this, "S3BucketName", {
      value: curriculumBucket.bucketName,
      description: "Curriculum S3 bucket name",
    });

    new cdk.CfnOutput(this, "IamAccessKeyId", {
      value: accessKey.accessKeyId,
      description: "IAM access key ID for the app user",
    });

    new cdk.CfnOutput(this, "IamSecretKeyArn", {
      value: accessKeySecret.secretArn,
      description: "Secrets Manager ARN for the IAM secret access key",
    });
  }
}
