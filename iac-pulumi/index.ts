import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as std from "@pulumi/std";
import { Topic } from "@pulumi/aws/sns";
const gcp = require("@pulumi/gcp");

const config = new pulumi.Config();
const awsProfile = config.require("profile");
const devDomain = config.require("devDomain");
const prodDomain = config.require("prodDomain");
const vpcCidrBlock: string = config.require("vpcCidrBlock");
const publicKeyPath: string = config.require("publicKeyPath");
const applicationPort = parseInt(config.require("appPort"), 10);
const certificateArn = config.require("certificateArn");
const publicKey = path.join(os.homedir(), publicKeyPath);
const publicKeyContent = fs.readFileSync(publicKey, "utf8");

var snsTopic = new aws.sns.Topic("mySNSTopic", {
  displayName: "My SNS Topic",
});
const ec2KeyPair = new aws.ec2.KeyPair("ec2keypair", {
  publicKey: publicKeyContent,
});

const run = async (): Promise<void> => {
  const availabilityZones: string[] = await aws
    .getAvailabilityZones({ state: "available" })
    .then((result) => result.names.slice(0, 3));

  const vpc = new aws.ec2.Vpc("vpc", {
    cidrBlock: vpcCidrBlock,
    enableDnsSupport: true,
    enableDnsHostnames: true,
    tags: { Name: "vpc" },
  });

  const igw = new aws.ec2.InternetGateway("internetGateway", {
    vpcId: vpc.id,
    tags: { Name: "internet_gateway" },
  });

  const publicRouteTable = new aws.ec2.RouteTable("publicRouteTable", {
    vpcId: vpc.id,
    routes: [
      {
        cidrBlock: "0.0.0.0/0",
        gatewayId: igw.id,
      },
    ],
    tags: { Name: "public-route-table" },
  });

  const privateRouteTable = new aws.ec2.RouteTable("privateRouteTable", {
    vpcId: vpc.id,
    tags: { Name: "private-route-table" },
  });

  const publicSubnets = availabilityZones.map((az, index) => {
    return new aws.ec2.Subnet(`publicSubnet-${index}`, {
      vpcId: vpc.id,
      cidrBlock: `${vpcCidrBlock.split(".")[0]}.${vpcCidrBlock.split(".")[1]}.${
        index + 1
      }.0/24`,
      availabilityZone: az,
      mapPublicIpOnLaunch: true,
      tags: { Name: `public-subnet-${index}` },
    });
  });

  const privateSubnets = availabilityZones.map((az, index) => {
    return new aws.ec2.Subnet(`privateSubnet-${index}`, {
      vpcId: vpc.id,
      cidrBlock: `${vpcCidrBlock.split(".")[0]}.${vpcCidrBlock.split(".")[1]}.${
        (index + 1) * 10
      }.0/24`,
      availabilityZone: az,
      tags: { Name: `private-subnet-${index}` },
    });
  });

  // Associate public subnets with public route table
  publicSubnets.forEach((subnet, index) => {
    new aws.ec2.RouteTableAssociation(`publicRTA-${index}`, {
      routeTableId: publicRouteTable.id,
      subnetId: subnet.id,
    });
  });

  // Associate private subnets with private route table
  privateSubnets.forEach((subnet, index) => {
    new aws.ec2.RouteTableAssociation(`privateRTA-${index}`, {
      routeTableId: privateRouteTable.id,
      subnetId: subnet.id,
    });
  });

  const app_lb_sg = new aws.ec2.SecurityGroup("app-lb-sg", {
    name: `${awsProfile}-app-load-balancer-sg`,
    description:
      "Load balancer security group to allow inbound traffic from the Internet",
    vpcId: vpc.id,
    ingress: [
      {
        fromPort: 443,
        toPort: 443,
        protocol: "tcp",
        cidrBlocks: ["0.0.0.0/0"],
      },
      {
        fromPort: 80,
        toPort: 80,
        protocol: "tcp",
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
    egress: [
      {
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
    tags: {
      name: `${awsProfile}-app-load-balancer-sg`,
    },
  });

  const appSecurityGroup = new aws.ec2.SecurityGroup(
    "applicationSecurityGroup",
    {
      name: `applicationSecurityGroup`,
      description:
        "Default security group to allow inbound/outbound from the VPC",
      vpcId: vpc.id,
      ingress: [
        {
          fromPort: 3000,
          toPort: 3000,
          protocol: "tcp",
          securityGroups: [app_lb_sg.id],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      tags: {
        name: `applicationSecurityGroup`,
      },
    }
  );

  const dbSecurityGroup = new aws.ec2.SecurityGroup("db-sg", {
    name: `database-sg`,
    description:
      "Database security group to allow inbound/outbound from the VPC",
    vpcId: vpc.id,
    ingress: [
      {
        fromPort: 3306,
        toPort: 3306,
        protocol: "tcp",
        securityGroups: [appSecurityGroup.id],
      },
    ],
    tags: {
      Name: `database-sg`,
    },
  });

  const dbSubnetGroup = new aws.rds.SubnetGroup("private_db_subnet_group", {
    name: "private_db_subnet_group",
    subnetIds: privateSubnets.map((subnet) => subnet.id),
  });

  const rdsParameterGroup = new aws.rds.ParameterGroup("rds_parameter_group", {
    name: "custompg",
    family: "mysql8.0",
    description: "Custom parameter group for RDS instances",
  });

  const rdsInstance = new aws.rds.Instance("rds_instance", {
    engine: "mysql",
    instanceClass: "db.t3.micro",
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,
    allocatedStorage: 20,
    dbSubnetGroupName: dbSubnetGroup.name,
    vpcSecurityGroupIds: [dbSecurityGroup.id],
    publiclyAccessible: false,
    multiAz: false,
    parameterGroupName: rdsParameterGroup.name,
    skipFinalSnapshot: true,
    identifier: "csye6225",
  });

  const customAmi = aws.ec2.getAmi({
    filters: [
      {
        name: "name",
        values: ["csye6225*"],
      },
    ],
    mostRecent: true,
  });

  const webappAmi = (await customAmi).id;
  const envSettings = pulumi
    .all([webappAmi, rdsInstance.address, rdsInstance.username, snsTopic.arn])
    .apply(([ami, address, username, snsTopicArn]) => {
      return {
        AMI: ami,
        HOST: address,
        USER_NAME: username,
        SNS_TOPIC_ARN: snsTopicArn,
      };
    });

  //   const dbName = process.env.DB_NAME;
  // const host = settings.HOST;
  // const username = settings.USER_NAME;
  // const password = process.env.DB_PASSWORD;

  const app_lb = new aws.lb.LoadBalancer("app-lb", {
    name: `${awsProfile}-app-load-balancer`,
    internal: false,
    loadBalancerType: "application",
    subnets: publicSubnets.map((s) => s.id),
    securityGroups: [app_lb_sg.id],
    tags: {
      name: `${awsProfile}-app-load-balancer`,
    },
  });

  envSettings.apply((settings) => {
    const ec2Csye6225Role = new aws.iam.Role("EC2-CSYE6225", {
      name: "EC2-CSYE6225",
      assumeRolePolicy: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "ec2.amazonaws.com",
            },
          },
        ],
      },
    });
    new aws.iam.RolePolicyAttachment("autoscaling-policy-attachment", {
      policyArn: "arn:aws:iam::aws:policy/AutoScalingFullAccess",
      role: ec2Csye6225Role.name,
    });

    const ec2InstanceProfile = new aws.iam.InstanceProfile(
      "EC2-CSYE6225-InstanceProfile",
      {
        name: "ec2_profile",
        role: ec2Csye6225Role.name,
      }
    );

    // Target group
    const webappTg = new aws.lb.TargetGroup("webappTg", {
      name: "webapp-tg",
      port: 3000,
      protocol: "HTTP",
      vpcId: vpc.id,
      targetType: "instance",
      healthCheck: {
        enabled: true,
        interval: 60,
        path: "/healthz",
        port: "traffic-port",
        protocol: "HTTP",
        timeout: 2,
        healthyThreshold: 2,
        unhealthyThreshold: 5,
      },
    });

    console.log("SNSTOPIC, ARN", snsTopic.arn);

    const webappListener = new aws.lb.Listener("webappListener", {
      loadBalancerArn: app_lb.arn,
      port: 443,
      protocol: "HTTPS",
      certificateArn: certificateArn,
      defaultActions: [
        {
          type: "forward",
          targetGroupArn: webappTg.arn,
          //targetGroupArn: certificateArn,
        },
      ],
    });

    const userData = `#!/bin/bash
sudo touch /home/webapp-user/.env
sudo echo DATABASE_NAME=${process.env.DB_NAME} >> /home/webapp-user/.env
sudo echo DB_HOST=${settings.HOST} >> /home/webapp-user/.env
sudo echo MYSQL_USERNAME=${settings.USER_NAME} >> /home/webapp-user/.env
sudo echo MYSQL_PASSWORD=${process.env.DB_PASSWORD} >> /home/webapp-user/.env
sudo echo TOPIC_ARN=${settings.SNS_TOPIC_ARN} >> /home/webapp-user/.env
sudo chown webapp-user:webapp-user /home/webapp-user/.env
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-config.json \
    -s
 
sudo systemctl start amazon-cloudwatch-agent
 
sudo systemctl enable amazon-cloudwatch-agent
`;
    const base64UserData = Buffer.from(userData).toString("base64");
    const asgLaunchTemplate = new aws.ec2.LaunchTemplate("asgLaunchTemplate", {
      name: "asg-launch-config",
      imageId: customAmi.then((customAmi) => customAmi.id),
      instanceType: "t2.micro",
      ebsOptimized: "false",
      disableApiTermination: false,
      keyName: ec2KeyPair.keyName,
      iamInstanceProfile: {
        name: ec2InstanceProfile.name,
      },
      networkInterfaces: [
        {
          associatePublicIpAddress: "true",
          subnetId: publicSubnets[0].id,
          securityGroups: [appSecurityGroup.id],
        },
      ],
      blockDeviceMappings: [
        {
          deviceName: "/dev/xvda",
          ebs: {
            volumeSize: 25,
            volumeType: "gp2",
            deleteOnTermination: "true",
          },
        },
      ],
      tagSpecifications: [
        {
          resourceType: "instance",
          tags: {
            name: "Webapp EC2 Instance",
          },
        },
      ],
      userData: base64UserData,
    });

    const cloudwatchAgentPolicyAttachment = new aws.iam.RolePolicyAttachment(
      "cloudwatch-agent-policy-attachment",
      {
        policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
        role: ec2Csye6225Role.name,
      }
    );

    console.log("AMI", webappAmi);

    const webappAsg = new aws.autoscaling.Group("webappAsg", {
      name: "webapp-asg",
      targetGroupArns: [webappTg.arn],
      vpcZoneIdentifiers: publicSubnets.map((s) => s.id),
      launchTemplate: {
        id: asgLaunchTemplate.id,
        version: "$Latest",
      },
      minSize: 1,
      maxSize: 3,
      desiredCapacity: 1,
      healthCheckType: "EC2",
      healthCheckGracePeriod: 300,
      defaultCooldown: 60,
      tags: [
        {
          key: "Name",
          value: "WebApp EC2 Instance",
          propagateAtLaunch: true,
        },
      ],
    });

    webappAsg.name.apply((asgName) => {
      const scaleUpPolicy = new aws.autoscaling.Policy("scaleUpPolicy", {
        name: "webapp_scale-up-policy",
        policyType: "SimpleScaling",
        autoscalingGroupName: asgName,
        scalingAdjustment: 1,
        adjustmentType: "ChangeInCapacity",
        metricAggregationType: "Average",
      });
      console.log("scaleUppolicy", asgName, scaleUpPolicy.arn);
      const scaleUpAlarm = new aws.cloudwatch.MetricAlarm("scaleUpAlarm", {
        name: "high-cpu-usage",
        comparisonOperator: "GreaterThanThreshold",
        evaluationPeriods: 2,
        metricName: "CPUUtilization",
        namespace: "AWS/EC2",
        period: 60,
        statistic: "Average",
        threshold: 5,
        alarmDescription:
          "This metric checks if CPU usage is higher than 5% in the past 2 min",
        alarmActions: [scaleUpPolicy.arn],
        // actionsEnabled: true,
        dimensions: {
          AutoScalingGroupName: asgName,
        },
      });
      // Scale down policy
      const scaleDownPolicy = new aws.autoscaling.Policy("scaleDownPolicy", {
        name: "webapp_scale-down-policy",
        policyType: "SimpleScaling",
        autoscalingGroupName: asgName,
        scalingAdjustment: -1,
        adjustmentType: "ChangeInCapacity",
        metricAggregationType: "Average",
      });

      const scaleDownAlarm = new aws.cloudwatch.MetricAlarm("scaleDownAlarm", {
        name: "low-cpu-usage",
        comparisonOperator: "LessThanThreshold",
        evaluationPeriods: 2,
        metricName: "CPUUtilization",
        // unit: "Percent",
        namespace: "AWS/EC2",
        period: 60,
        statistic: "Average",
        threshold: 3,
        alarmDescription:
          "This metric checks if CPU usage is lower than 3% for the past 2 min",
        alarmActions: [scaleDownPolicy.arn],
        // actionsEnabled: true,
        dimensions: {
          AutoScalingGroupName: asgName,
        },
      });
    });
    // Scale up policy

    const snsPublishPolicy = new aws.iam.Policy("snsPublishPolicy", {
      policy: pulumi.interpolate`{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "sns:Publish",
        "Resource": "${snsTopic.arn}"
      }
    ]
  }`,
    });

    new aws.iam.RolePolicyAttachment("snsPublishRolePolicyAttachment", {
      role: ec2Csye6225Role.name,
      policyArn: snsPublishPolicy.arn,
    });
  });

  const domainName = awsProfile === "dev" ? devDomain : prodDomain;
  const selectedZone = aws.route53.getZone(
    { name: domainName },
    { async: true }
  );
  const newRecord = selectedZone.then((zoneInfo) => {
    return new aws.route53.Record("new_record", {
      zoneId: selectedZone.then((zone) => zone.zoneId),
      name: selectedZone.then((zone) => zone.name),
      type: "A",
      // ttl: 60, // Set the Time To Live for the DNS record, in seconds
      aliases: [
        {
          name: app_lb.dnsName,
          zoneId: app_lb.zoneId,
          evaluateTargetHealth: true,
        },
      ],
    });
  });
  const webappLogGroup = new aws.cloudwatch.LogGroup("webapp_log_group", {
    name: "csye6225",
  });

  // Get the EC2 Role

  // IAM role for Lambda
  const lambdaRole = new aws.iam.Role("lambdaRole", {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Action: "sts:AssumeRole",
          Principal: {
            Service: "lambda.amazonaws.com",
          },
          Effect: "Allow",
        },
      ],
    }),
  });

  // IAM policy for Lambda
  const lambdaPolicy = new aws.iam.Policy("lambdaPolicy", {
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Action: [
            "dynamodb:PutItem",
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
            "logs:DescribeLogStreams",
            "cloudwatch:PutMetricData",
            "cloudwatch:GetMetricStatistics",
            "cloudwatch:ListMetrics",
            "cloudwatch:DescribeAlarms",
            "cloudwatch:PutMetricAlarm",
            "cloudwatch:GetMetricWidgetImage",
            "cloudwatch:GetMetricData",
            "cloudwatch:SetAlarmState",
          ],
          Effect: "Allow",
          Resource: "*",
        },
      ],
    }),
  });

  // Google Cloud Storage bucket
  const bucket = new gcp.storage.Bucket("webapp", {
    location: "US",
    uniformBucketLevelAccess: true,
    forceDestroy: true,
  });

  // Google Service Account
  const serviceAccount = new gcp.serviceaccount.Account("myServiceAccount", {
    accountId: "cloud-demo01",
    displayName: "My Service Account",
  });

  // Google Service Account Key
  const serviceAccountKey = new gcp.serviceaccount.Key("myServiceAccountKey", {
    serviceAccountId: serviceAccount.name,
  });

  const gcpBucketIAMBinding = new gcp.storage.BucketIAMMember(
    "bucketIAMMember",
    {
      bucket: bucket.id,
      role: "roles/storage.objectCreator",
      member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
    }
  );

  const publicReadBinding = new gcp.storage.BucketIAMMember(
    "publicReadBinding",
    {
      bucket: bucket.id,
      role: "roles/storage.objectViewer",
      member: "allUsers",
    }
  );
  // DynamoDB table for tracking emails
  const emailTable = new aws.dynamodb.Table("emailTable", {
    attributes: [{ name: "id", type: "S" }],
    hashKey: "id",
    billingMode: "PAY_PER_REQUEST",
  });

  // Attach the managed policy to the role
  const lambdaPolicyAttachment = new aws.iam.RolePolicyAttachment(
    "lambdaPolicyAttachment",
    {
      role: lambdaRole.name,
      policyArn: lambdaPolicy.arn,
    }
  );

  // Lambda function
  const lambdaFunction = new aws.lambda.Function("myLambdaFunction", {
    code: new pulumi.asset.FileArchive(
      "/Users/saisumanthgaali/Documents/Cloud_ Assignment/Latest/serverless.zip"
    ),
    handler: "index.handler",
    role: lambdaRole.arn,
    runtime: "nodejs18.x",
    environment: {
      variables: {
        SNS_TOPIC_ARN: snsTopic.arn,
        DYNAMODB_TABLE_NAME: emailTable.name,
        GCS_BUCKET_NAME: bucket.name,
        GCS_SERVICE_ACCOUNT_KEY: serviceAccountKey.privateKey,
        MAILGUN_API_KEY: "MAILGUN_KEY",
        MAILGUN_DOMAIN: "demo.gvsss3.com",
        GOOGLE_CLIENT_MAIL:
          "cloud-demo01@active-thunder-406602.iam.gserviceaccount.com",
        GOOGLE_PROJECT_ID: "active-thunder-406602",
      },
    },
  });

  // Grant SNS permissions to invoke the lambda function
  let snsInvokeLambda = new aws.lambda.Permission("snsInvokeLambda", {
    action: "lambda:InvokeFunction",
    function: lambdaFunction,
    principal: "sns.amazonaws.com",
    sourceArn: snsTopic.arn,
  });

  // Configure SNS topic to trigger lambda function
  let lambdaTrigger = new aws.sns.TopicSubscription("lambdaTrigger", {
    endpoint: lambdaFunction.arn.apply((arn) => arn),
    protocol: "lambda",
    topic: snsTopic.arn,
  });
};

run();
