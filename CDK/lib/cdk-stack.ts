import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as datasync from 'aws-cdk-lib/aws-datasync';
import * as awslogs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as apigateway from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apiIntegration from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineactions from 'aws-cdk-lib/aws-codepipeline-actions';

import { EFS_DEFAULT_ENCRYPTION_AT_REST } from 'aws-cdk-lib/cx-api';

import * as path from 'path';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //get account and region of this stack
    let account = this.account;
    let region = this.region;

    /************************ VPC Creation ********************/
    let vpc = new ec2.Vpc(this, 'AMB-CICD-Blog-VPC', {
      vpcName: "AMB-CICD-Blog-VPC",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 3,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ]
    });

    let publicSubnetArn1=`arn:aws:ec2:${region}:${account}:subnet/${vpc.publicSubnets[0].subnetId}`;
    let publicSubnetArn2=`arn:aws:ec2:${region}:${account}:subnet/${vpc.publicSubnets[1].subnetId}`;

    /************************ Security Group ********************/
    let secGroup = new ec2.SecurityGroup(this, 'AMB-CICD-Blog-SecGroup', {
      vpc,
      description: 'Allow SSH traffic and all traffic within this group',
      allowAllOutbound: true,
      securityGroupName: "AMB-CICD-Blog-SecGroup"
    });
    secGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8545), 'All Ethreum HTTP RPC Traffic');
    secGroup.addIngressRule(secGroup, ec2.Port.allTraffic(), 'Allow all traffic associated with this security group');
    let securityGroupArn=`arn:aws:ec2:${region}:${account}:security-group/${secGroup.securityGroupId}`;

    /************************ IAM Policies & Role ********************/
    //DynamoDb Read/Write access for Lambda
    let dynamoDBReadWritePolicy = new iam.ManagedPolicy(this, "AMB-CICD-Blog-DynamoDBReadWrite", {
      managedPolicyName: "AMB-CICD-Blog-DynamoDBReadWrite",
      statements: [new iam.PolicyStatement({
        sid: "AMBCICDBlogPolicy1",
        actions: [
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:PartiQLUpdate",
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
          "dynamodb:CreateTable",
          "dynamodb:PartiQLSelect",
          "dynamodb:DescribeTable",
          "dynamodb:PartiQLInsert",
          "dynamodb:GetItem",
          "dynamodb:UpdateTable",
          "dynamodb:GetRecords",
          "dynamodb:PartiQLDelete"
        ],
        effect: iam.Effect.ALLOW,
        resources: ["*"]
      })]
    });

    //SecretManagerReadAccess Policy
    let secReadPolicy = new iam.ManagedPolicy(this, "AMB-CICD-Blog-SecretMgrReadAccess", {
      managedPolicyName: "AMB-CICD-Blog-SecretMgrReadAccess",
      statements: [new iam.PolicyStatement({
        sid: "AMBCICDBlogPolicy2",
        actions: ["secretsmanager:GetSecretValue"],
        effect: iam.Effect.ALLOW,
        resources: ["*"]
      })]
    });

    //codecommit access for lambda policy
    let gitLambdaAccessPolicy=new iam.ManagedPolicy(this, "AMB-CICD-Blog-GitLambdaAccessPolicy", {
      managedPolicyName: "AMB-CICD-Blog-GitLambdaAccessPolicy",
      statements: [new iam.PolicyStatement({
        sid: "AMBCICDBlogPolicy3",
        actions: [
          "codecommit:GitPull",
          "codecommit:GetRepository"
        ],
        effect: iam.Effect.ALLOW,
        resources: ["*"]
      })]
    });
    //CodeBuildServiceRolePolicy
    let codeBuildSrvRolePol = new iam.ManagedPolicy(this, "AMB-CICD-Blog-CodeBuildSvcRolePolicy", {
      managedPolicyName: "AMB-CICD-Blog-CodeBuildSvcRolePolicy",
      statements: [
        new iam.PolicyStatement({
          sid: "AMBCICDBlogPolicy4",
          actions: [
            "logs:CreateLogGroup",
            "logs:PutLogEvents",
            "logs:CreateLogStream",
            "codecommit:GitPull",
            "s3:GetObject",
            "s3:GetBucketLocation",
            "s3:PutObject",
            "s3:PutBucketAcl",
            "s3:GetBucketAcl",
            "s3:GetObjectVersion",
            "ecr:GetDownloadUrlForLayer",
            "ecr:GetAuthorizationToken",
            "ecr:BatchGetImage",
            "ecr:BatchCheckLayerAvailability",
            "elasticfilesystem:DescribeMountTargets",
            "elasticfilesystem:CreateFileSystem",
            "elasticfilesystem:ClientWrite",
            "elasticfilesystem:ClientMount",
            "elasticfilesystem:DescribeFileSystems",
            "secretsmanager:GetSecretValue",
            "codebuild:CreateReportGroup",
            "codebuild:CreateReport",
            "codebuild:UpdateReport",
            "codebuild:BatchPutTestCases",
            "codebuild:BatchPutCodeCoverages",
            "ec2:CreateNetworkInterface",
            "ec2:DescribeDhcpOptions",
            "ec2:DescribeNetworkInterfaces",
            "ec2:DeleteNetworkInterface",
            "ec2:DescribeSubnets",
            "ec2:DescribeSecurityGroups",
            "ec2:DescribeVpcs",
            "lambda:UpdateFunctionCode",
            "lambda:UpdateFunctionConfiguration",
            "lambda:GetFunction"
          ],
          effect: iam.Effect.ALLOW,
          resources: ["*"]
        }),
      ]
    });

    //CodePipelinePolicies
    let codePipelinePolicies = new iam.ManagedPolicy(this, "AMB-CICD-Blog-CodePipelinePolicies", {
      managedPolicyName: "AMB-CICD-Blog-CodePipelinePolicies",
      statements:[
        new iam.PolicyStatement({
          sid: "AMBCICDBlogPolicy4",
          actions: [
            "iam:PassRole"
          ],
          effect: iam.Effect.ALLOW,
          resources: ["*"],
          conditions: {
            "StringEquals": {
              "iam:PassedToService": [
                "cloudformation.amazonaws.com",
                "elasticbeanstalk.amazonaws.com",
                "ec2.amazonaws.com",
                "ecs-tasks.amazonaws.com"
              ]
            }
          }
        }),
        new iam.PolicyStatement({
          sid: "AMBCICDBlogPolicy5",
          actions: [
            "codecommit:CancelUploadArchive",
            "codecommit:GetBranch",
            "codecommit:GetCommit",
            "codecommit:GetRepository",
            "codecommit:GetUploadArchiveStatus",
            "codecommit:UploadArchive",

            "codebuild:BatchGetBuilds",
            "codebuild:StartBuild",
            "codebuild:BatchGetBuildBatches",
            "codebuild:StartBuildBatch",

            "lambda:InvokeFunction",
            "lambda:ListFunctions",

            "ecr:DescribeImages",

            "states:DescribeExecution",
            "states:DescribeStateMachine",
            "states:StartExecution",
            "ec2:*",
            "elasticloadbalancing:*",
            "autoscaling:*",
            "cloudwatch:*",
            "s3:*",
            "cloudformation:*",
          ],
          effect: iam.Effect.ALLOW,
          resources: ["*"],
        }),
      ]
    });
    //CodePipelineServiceRole
    let codePipelineSvcRole = new iam.Role(this, "AMB-CICD-Blog-CodePipelineSvcRole", {
      roleName: "AMB-CICD-Blog-CodePipelineSvcRole",
      assumedBy: new iam.ServicePrincipal("codepipeline.amazonaws.com"),
      description: "This role will be assume by CodePipeline to implement smart contract build as part of CI/CD",
      managedPolicies: [codePipelinePolicies,codeBuildSrvRolePol]
    });
    //CodeBuildServiceRole
    let codeBuildSrvRole = new iam.Role(this, "AMB-CICD-Blog-CodeBuildSvcRole", {
      roleName: "AMB-CICD-Blog-CodeBuildSvcRole",
      assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
      description: "This role will be assume by CodeBuild to implement smart contract build as part of CI/CD",
      managedPolicies: [codeBuildSrvRolePol]
    });

    //Besu-NodeContainerExecutionRole
    let besuECSExecRole = new iam.Role(this, "AMB-CICD-Blog-BesuECSExecRole", {
      roleName: "AMB-CICD-Blog-BesuECSExecRole",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "ECS task will assume this role to run besu node on ECS",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchLogsFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonElasticFileSystemClientFullAccess")]
    });

    //ShareToWinLambda ExecutionRole
    let lambdaExecRole = new iam.Role(this, "AMB-CICD-Blog-LambdaExecRole", {
      roleName: "AMB-CICD-Blog-LambdaExecRole",
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "NFT marketplace lambda will assume this role",
      managedPolicies: [
        secReadPolicy,
        gitLambdaAccessPolicy,
        dynamoDBReadWritePolicy,
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
      ]
    });
    //custom resource lambda role
    let customResourceLambdaRole = new iam.Role(this, "AMB-CICD-Blog-CustomResourceLambdaRole", {
      roleName: "AMB-CICD-Blog-CustomResourceLambdaRole",
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "Custome resource lambda will assume this role",
      managedPolicies: [
        secReadPolicy,
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonElasticFileSystemClientFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSDataSyncFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonECS_FullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2FullAccess")
      ]
    });
    //DataSync role for file transfer from S3 to EFS
    let dataSyncTransferRole = new iam.Role(this, "AMB-CICD-Blog-DataSyncTransferRole", {
      roleName: "AMB-CICD-Blog-DataSyncTransferRole",
      assumedBy: new iam.ServicePrincipal("datasync.amazonaws.com"),
      description: "DataSync role for file transfer from S3 to EFS",
      managedPolicies: [
        secReadPolicy,
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonElasticFileSystemClientFullAccess")
      ]
    });

    /************************ Create EFS file system for Besu ********************/
    let elasticFileSys = new efs.FileSystem(this, "AMB-CICD-Blog-EFS", {
      fileSystemName: "AMB-CICD-Blog-EFS",
      vpc: vpc,
      enableAutomaticBackups: true,
      encrypted: true,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_30_DAYS,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      securityGroup: secGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })
    //create EFS access point
    let efsBesuDirAccessPoint = new efs.AccessPoint(this, "AMB-CICD-Blog-BesuDirAccessPoint", {
      fileSystem: elasticFileSys,
      path: "/besu-dev-network",
      createAcl: {
        ownerUid: '1000',
        ownerGid: '1000',
        permissions: '777',
      },
      // enforce the POSIX identity so lambda function will access with this identity
      posixUser: {
        uid: '1000',
        gid: '1000',
      }
    });

    //lambda EFS management OnEvent function
    let lambdaEFSMgntFuncOnEvent = new lambda.Function(this, "AMB-CICD-Blog-EFSManagmentOnEvent", {
      functionName: "AMB-CICD-Blog-EFSManagmentOnEvent",
      allowPublicSubnet: true,
      filesystem: lambda.FileSystem.fromEfsAccessPoint(efsBesuDirAccessPoint, '/mnt/efs'),
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, 'EFSManagement/OnEvent')),
      timeout: cdk.Duration.seconds(300),
      role: customResourceLambdaRole,
      vpc: vpc
    });
    let lambdaEFSMgntFuncOnComplete = new lambda.Function(this, "AMB-CICD-Blog-EFSManagmentOnComplete", {
      functionName: "AMB-CICD-Blog-EFSManagmentOnComplete",
      allowPublicSubnet: true,
      filesystem: lambda.FileSystem.fromEfsAccessPoint(efsBesuDirAccessPoint, '/mnt/efs'),
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, 'EFSManagement/OnComplete')),
      timeout: cdk.Duration.seconds(300),
      role: customResourceLambdaRole,
      vpc: vpc
    });
    let efsLambdaMgmtProvider = new cr.Provider(this, "amb-cicd-efsLambdaMgmtProvider", {
      onEventHandler: lambdaEFSMgntFuncOnEvent,
      isCompleteHandler: lambdaEFSMgntFuncOnComplete,
    })
    //custom resource to execute the EFS lambda
    let custRsrcEfsMgmtLambdaExec = new cdk.CustomResource(this, "AMB-CICD-Blog-CustRsrcEfsMgmtLambdaExec", {
      serviceToken: efsLambdaMgmtProvider.serviceToken
    });
    custRsrcEfsMgmtLambdaExec.node.addDependency(elasticFileSys);
    /************************ S3 Bucket and supporting files for the CI/CD solution ********************/
    let cicdBucket = new s3.Bucket(this, "AMB-CICD-Blog-S3Bucket", {
      bucketName: "amb-cicd-blog-s3bucket",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true
    });

    let s3fileDeploy = new s3deploy.BucketDeployment(this, "AMB-CICD-Blog-S3FileDeploy", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../resources/BucketFiles"))],
      destinationBucket: cicdBucket
    });

    /************************ DataSync to transfer files from S3 to EFS ********************/
    let s3Location = new datasync.CfnLocationS3(this, "AMB-CICD-Blog-S3Location", {
      s3Config: {
        bucketAccessRoleArn: dataSyncTransferRole.roleArn
      },
      s3BucketArn: cicdBucket.bucketArn,
    });
    s3Location.node.addDependency(cicdBucket);

    let efsLocation=new datasync.CfnLocationEFS(this, "AMB-CICD-Blog-EFSLocation", {
      ec2Config: {
        subnetArn: publicSubnetArn1,
        securityGroupArns:[securityGroupArn]
      },
      accessPointArn:efsBesuDirAccessPoint.accessPointArn,
      efsFilesystemArn:elasticFileSys.fileSystemArn,
      fileSystemAccessRoleArn:dataSyncTransferRole.roleArn,
      inTransitEncryption:"TLS1_2",
      subdirectory: "config"
    });
    efsLocation.node.addDependency(elasticFileSys);
    efsLocation.node.addDependency(efsBesuDirAccessPoint);
    efsLocation.node.addDependency(custRsrcEfsMgmtLambdaExec);

    let dataSyncTaskLogGroup=new awslogs.LogGroup(this, "AMB-CICD-Blog-DataSyncTaskLogGroup", {
      logGroupName: "AMB-CICD-Blog-DataSyncTaskLogGroup",
      removalPolicy:cdk.RemovalPolicy.DESTROY
    });
    dataSyncTaskLogGroup.grantWrite(new iam.ServicePrincipal("datasync.amazonaws.com"));
    
    let dataSyncTask = new datasync.CfnTask(this, "AMB-CICD-Blog-DataSyncTask", {
      name:"AMB-CICD-Blog-DataSyncTask",
      sourceLocationArn: s3Location.attrLocationArn,
      destinationLocationArn: efsLocation.attrLocationArn,
      includes:[
        {
          filterType:"SIMPLE_PATTERN",
          value:"/config.toml|/dev.json"
        }
      ],
      cloudWatchLogGroupArn: dataSyncTaskLogGroup.logGroupArn,
      options:{
        logLevel:"TRANSFER",
        overwriteMode:"ALWAYS",
        transferMode:"ALL",
        verifyMode:"ONLY_FILES_TRANSFERRED",
        posixPermissions:"NONE",
        uid:"NONE",
        gid:"NONE"
      }
    });
    dataSyncTask.node.addDependency(s3Location);
    dataSyncTask.node.addDependency(efsLocation);
    dataSyncTask.node.addDependency(dataSyncTaskLogGroup);

    //DataSync Task Execution OnEvent function
    let lambdaDataSyncTastExecFuncOnEvent = new lambda.Function(this, "AMB-CICD-Blog-DataSyncTastExecOnEvent", {
      code: lambda.Code.fromAsset(path.join(__dirname, 'DataSyncTaskExec/OnEvent')),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      description: "Lambda to move files from S3 to EFS via DataSync Task",
      environment:{"STACK_REGION":region,"TASK_ARN":dataSyncTask.attrTaskArn},
      functionName: "AMB-CICD-Blog-DataSyncTastExecOnEvent",
      timeout: cdk.Duration.seconds(600),
      role: customResourceLambdaRole
    });
    
    //DataSync Task Execution Lambda function
    let lambdaDataSyncTastExecFuncOnComplete = new lambda.Function(this, "AMB-CICD-Blog-DataSyncTastExecOnComplete", {
      code: lambda.Code.fromAsset(path.join(__dirname, 'DataSyncTaskExec/OnComplete')),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      description: "Lambda to move files from S3 to EFS via DataSync Task",
      environment:{"STACK_REGION":region,"TASK_ARN":dataSyncTask.attrTaskArn},
      functionName: "AMB-CICD-Blog-DataSyncTastExecOnComplete",
      timeout: cdk.Duration.seconds(600),
      role: customResourceLambdaRole
    });
    let dataSyncTaskExecProvider = new cr.Provider(this, "amb-cicd-dataSyncTaskExecProvider", {
      onEventHandler: lambdaDataSyncTastExecFuncOnEvent,
      isCompleteHandler: lambdaDataSyncTastExecFuncOnComplete,
    })

    //custom resource to execute the EFS lambda
    let custRsrcDataSyncTaskLambdaExec = new cdk.CustomResource(this, "AMB-CICD-Blog-CustRsrcDataSyncTaskLambdaExec", {
      serviceToken: dataSyncTaskExecProvider.serviceToken
    });
    custRsrcDataSyncTaskLambdaExec.node.addDependency(dataSyncTask);


    /************************ ECS and Besu Node ********************/
    let besuNetworkCluster = new ecs.Cluster(this, "AMB-CICD-Blog-BesuNetworkCluster", {
      clusterName: "AMB-CICD-Blog-BesuNetworkCluster",
      enableFargateCapacityProviders: true,
      vpc: vpc
    });

    let besuNetworkTaskDef = new ecs.FargateTaskDefinition(this, "AMB-CICD-Blog-BesuNetworkTaskDef", {
      cpu: 2048,
      executionRole: besuECSExecRole,
      family: "AMB-CICD-Blog-BesuDevNetwork",
      memoryLimitMiB: 4096,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX
      },
      taskRole: besuECSExecRole,
      volumes: [
        {
          name: "EfsBesuNodeStorage",
          efsVolumeConfiguration: {
            fileSystemId: elasticFileSys.fileSystemId,
            rootDirectory: "/",
            transitEncryption: "ENABLED",
            authorizationConfig: {
              accessPointId: efsBesuDirAccessPoint.accessPointId,
              iam: "ENABLED"
            }
          }
        }
      ]
    });
    besuNetworkTaskDef.node.addDependency(besuECSExecRole);

    let besuNetworkContainDef = new ecs.ContainerDefinition(this, "AMB-CICD-Blog-BesuNetworkContainDef", {
      image: ecs.ContainerImage.fromRegistry("hyperledger/besu"),
      taskDefinition: besuNetworkTaskDef,
      containerName: "BesudevNode1",
      entryPoint: [
        "/bin/bash",
        "-c",
        "/opt/besu/bin/besu --config-file=/mount/efs/config/config.toml --genesis-file=/mount/efs/config/dev.json --data-path=/mount/efs/devNode1/data"
      ],
      essential: true,
      logging:ecs.LogDrivers.awsLogs({
        streamPrefix: "ecs",
        logGroup:new awslogs.LogGroup(this,"AMB-CICD-Blog-BesuNetworkLogGroup",{
          logGroupName:"/ecs/besudevnetwork",
          removalPolicy:cdk.RemovalPolicy.DESTROY,
        })
      }),
      portMappings: [
        {
          containerPort: 8545, 
          protocol: ecs.Protocol.TCP
        },
        {
          containerPort: 8546, 
          protocol: ecs.Protocol.TCP
        },
        {
          containerPort: 8547, 
          protocol: ecs.Protocol.TCP
        },
        {
          containerPort: 9001, 
          protocol: ecs.Protocol.TCP
        },
        {
          containerPort: 30303, 
          protocol: ecs.Protocol.TCP
        },
        {
          containerPort: 9545, 
          protocol: ecs.Protocol.TCP
        },
        {
          containerPort: 30303, 
          protocol: ecs.Protocol.UDP
        },
        {
          containerPort: 9545, 
          protocol: ecs.Protocol.UDP
        },
      ],
    });
    besuNetworkContainDef.node.addDependency(besuNetworkTaskDef);
    
    besuNetworkContainDef.addMountPoints(
      {
        containerPath:"/mount/efs",
        readOnly: false,
        sourceVolume:"EfsBesuNodeStorage"
      }
    )
    
    //Besu node custom resource handler for OnEvent
    let lambdaBesuEcsTaskStartFuncOnEvent = new lambda.Function(this, "AMB-CICD-Blog-BesuEcsTaskStartOnEvent", {
      code: lambda.Code.fromAsset(path.join(__dirname, 'ECSTaskExec/OnEvent')),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      description: "Lambda to start Besu node on ecs and capture the container public ip",
      environment:{"STACK_REGION":region,"TASK_DEF_ARN":besuNetworkTaskDef.taskDefinitionArn,"CLUSTER_NAME":besuNetworkCluster.clusterName,"TASK_SUBNETID":vpc.publicSubnets[0].subnetId,"SEC_GROUP_ID": secGroup.securityGroupId},
      functionName: "AMB-CICD-Blog-BesuEcsTaskStartOnEvent",
      timeout: cdk.Duration.seconds(100),
      role: customResourceLambdaRole,
    });
    //Besu node custom resource handler for OnComplete
    let lambdaBesuEcsTaskStartFuncOnComplete = new lambda.Function(this, "AMB-CICD-Blog-BesuEcsTaskStartOnComplete", {
      code: lambda.Code.fromAsset(path.join(__dirname, 'ECSTaskExec/OnComplete')),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      description: "Lambda to start Besu node on ecs and capture the container public ip",
      environment:{"STACK_REGION":region,"CLUSTER_NAME":besuNetworkCluster.clusterName},
      functionName: "AMB-CICD-Blog-BesuEcsTaskStartOnComplete",
      timeout: cdk.Duration.seconds(100),
      role: customResourceLambdaRole,
    });

    let ecsTaskExecProvider = new cr.Provider(this, "amb-cicd-ecsTaskExecProvider", {
      onEventHandler: lambdaBesuEcsTaskStartFuncOnEvent,
      isCompleteHandler: lambdaBesuEcsTaskStartFuncOnComplete,
    })

    //custom resource to start ECS fargate task for besu node
    let custRsrcEcsTaskLambdaExec = new cdk.CustomResource(this, "AMB-CICD-Blog-CustRsrcEcsTaskLambdaExec", {
      serviceToken: ecsTaskExecProvider.serviceToken
    });
    custRsrcEcsTaskLambdaExec.node.addDependency(custRsrcDataSyncTaskLambdaExec);
    custRsrcEcsTaskLambdaExec.node.addDependency(besuNetworkCluster);
    custRsrcEcsTaskLambdaExec.node.addDependency(besuNetworkContainDef);

    //Get the public ip of the container
    let besuNodePublicIp = custRsrcEcsTaskLambdaExec.getAttString("PublicIp");
    let IPOutput = new cdk.CfnOutput(this, "BesuNodePublicIP", {value:besuNodePublicIp});

    /*************************** Secret Manager ************************/
    let secMgrSecrets=new secretsmanager.Secret(this, "AMB-CICD-Blog-Secrets", {
      secretName: "AMB-CICD-Blog-Secrets",
      description: "Captures all the secrets required by CodeBuild and ShareToWinLambda",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      secretObjectValue:{
        "/CodeBuild/BesuMnemonicString":cdk.SecretValue.unsafePlainText("discover urban bicycle bless elephant amazing knife comfort cousin brisk corn satoshi"),
        "/CodeBuild/GeorliMnemonicString":cdk.SecretValue.unsafePlainText("To be entered"),
        "/CodeBuild/MainnetMnemonicString":cdk.SecretValue.unsafePlainText("To be entered"),
        "/CodeBuild/AccessKey":cdk.SecretValue.unsafePlainText("To be entered"),
        "/CodeBuild/SecretKey":cdk.SecretValue.unsafePlainText("To be entered"),
        "/CodeBuild/BillingTokenUrl":cdk.SecretValue.unsafePlainText("To be entered"),
      }
    });

    /******************* ShareToWinLambda & API Gateway & DynamoDB Table ********************/

    let ShareToWinDevDB=new dynamodb.Table(this, "AMB-CICD-Blog-ShareToWinDevDB", {
      tableName: "AMB-CICD-Blog-ShareToWinDevDB",
      partitionKey: { name: "AssetID", type: dynamodb.AttributeType.NUMBER },
      readCapacity: 1,
      writeCapacity: 1,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    
    let ShareToWinLambdaLayer = new lambda.LayerVersion(this, "AMB-CICD-Blog-ShareToWinLambdaLayer", {
      code: lambda.Code.fromBucket(cicdBucket,"BlockchainDevLayer.zip"),
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    ShareToWinLambdaLayer.node.addDependency(s3fileDeploy);
    
    let appLambdaShareToWinFunc = new lambda.Function(this, "AMB-CICD-Blog-ShareToWinLambda", {
      code: lambda.Code.fromBucket(cicdBucket,"ShareToWinLambda.zip"),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      description: "ShareToWin Decentralized application middle tier logic in lambda",
      environment:{"DYNAMODB_NAME":ShareToWinDevDB.tableName,"NETWORK_ENDPOINT":besuNodePublicIp,"CONTRACTADDRESS":"ToBeEntered","NODE_OPTIONS":"--experimental-fetch","SECRET_MGR_STR":secMgrSecrets.secretName},
      functionName: "AMB-CICD-Blog-ShareToWinLambda",
      paramsAndSecrets:lambda.ParamsAndSecretsLayerVersion.fromVersion(lambda.ParamsAndSecretsVersions.V1_0_103),
      layers:[ShareToWinLambdaLayer],
      role:lambdaExecRole,
      timeout: cdk.Duration.seconds(180),
    });
    appLambdaShareToWinFunc.node.addDependency(ShareToWinLambdaLayer);

    //api gateway for ShareToWin lambda
    let httpApiShareToWin = new apigateway.HttpApi(this, "AMB-CICD-Blog-ShareToWinAPI", {
      apiName: "AMB-CICD-Blog-ShareToWinAPI",
    });
    httpApiShareToWin.addRoutes({
      path: "/{proxy+}",
      methods: [apigateway.HttpMethod.ANY],
      integration: new apiIntegration.HttpLambdaIntegration("ShareToWinLambdaIntegration", appLambdaShareToWinFunc),
    })
    //add permissions for the api gateway
    appLambdaShareToWinFunc.addPermission("ShareToWinLambdaPermission", {
      action: "lambda:InvokeFunction",
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      sourceArn: `arn:aws:execute-api:${region}:${account}:${httpApiShareToWin.httpApiId}/*/*/{proxy+}`
    });

    /************************ CodeCommit ********************/
    let codeRepo=new codecommit.Repository(this, "AMB-CICD-Blog-CodeCommit", {
      repositoryName: "AMB-CICD-Blog-ShareToWinCode",
      description: "Smart contract and Lambda code for the CI/CD blog",
      code: codecommit.Code.fromZipFile(path.join(__dirname, "../resources/ShareToWinCode/ShareToWinCode.zip"))
    });

    /************************ CodeBuild ********************/
    //Besu build project
    let codeBuiltBesuProject=new codebuild.PipelineProject(this, "AMB-CICD-Blog-SmartContract-DevEnvBuild", {
      projectName: "AMB-CICD-Blog-SmartContract-DevEnvBuild",
      description: "Builds the smart contract for the besu network",
      buildSpec:codebuild.BuildSpec.fromAsset(path.join(__dirname, "../resources/StaticFiles/besubuildspec.yml")),
      cache: codebuild.Cache.none(),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.SMALL,
        environmentVariables: {
          "BESU_NODE1_ENDPOINT": {
            value: `http://${besuNodePublicIp}:8545`,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT
          },
          "MNEMONIC_STRING": {
            value: secMgrSecrets.secretArn + ":/CodeBuild/BesuMnemonicString",
            type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
          },
          "SHARETOWIN_DB_NAME":{
            value:ShareToWinDevDB.tableName,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT
          },
          "SECRET_MGR_STR": {
            value: secMgrSecrets.secretName,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT
          },
          "AMB_HTTP_TOKEN_URL": {
            value: secMgrSecrets.secretArn + ":/CodeBuild/BillingTokenUrl",
            type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
          }
        }
      },
      logging: {
        cloudWatch:{
          enabled: true,
          logGroup: new awslogs.LogGroup(this, "AMB-CICD-Blog-SmartContract-DevEnvBuildLogs", {
            logGroupName: "/codebuild/besubuiltlogs",
            removalPolicy:cdk.RemovalPolicy.DESTROY
          })
        }
      },
      role:codeBuildSrvRole
    });
    //Goerli build project
    let codeBuiltGoerliProject=new codebuild.PipelineProject(this, "AMB-CICD-Blog-SmartContract-TestEnvBuild", {
      projectName: "AMB-CICD-Blog-SmartContract-TestEnvBuild",
      description: "Builds the smart contract for the Goerli network",
      buildSpec:codebuild.BuildSpec.fromAsset(path.join(__dirname, "../resources/StaticFiles/goerlibuildspec.yml")),
      cache: codebuild.Cache.none(),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.SMALL,
        environmentVariables: {
          "BESU_NODE1_ENDPOINT": {
            value: `http://${besuNodePublicIp}:8545`,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT
          },
          "AMB_HTTP_TOKEN_URL": {
            value: secMgrSecrets.secretArn + ":/CodeBuild/BillingTokenUrl",
            type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
          },
          "MNEMONIC_STRING": {
            value: secMgrSecrets.secretArn + ":/CodeBuild/GeorliMnemonicString",
            type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
          },
        }
      },
      logging: {
        cloudWatch:{
          enabled: true,
          logGroup: new awslogs.LogGroup(this, "AMB-CICD-Blog-SmartContract-TestEnvBuildLogs", {
            logGroupName: "/codebuild/goerlibuiltlogs",
            removalPolicy:cdk.RemovalPolicy.DESTROY
          })
        }
      },
      role:codeBuildSrvRole
    });
    
    /************************ CodePipeline ********************/
    let sourceOutput = new codepipeline.Artifact('SourceArtifact');
    let sourceAction=new codepipelineactions.CodeCommitSourceAction({
      actionName: "AMB-CICD-Blog-CodeCommit-CodeSource",
      repository: codeRepo,
      branch: "main",
      output: sourceOutput,
      runOrder: 1
    });

    let devBuiltOutput = new codepipeline.Artifact('BuildDevArtifact');
    let builtDevAction=new codepipelineactions.CodeBuildAction({
      actionName: "AMB-CICD-Blog-CodeBuild-CompileDeployDev",
      input: sourceOutput,
      project: codeBuiltBesuProject,
      runOrder: 2,
      type: codepipelineactions.CodeBuildActionType.BUILD,
      outputs: [devBuiltOutput],
      variablesNamespace:"BuildDevVariables"
    });
    let manualApprovalAction=new codepipelineactions.ManualApprovalAction({
      actionName: "AMB-CICD-Blog-CodePipeline-ManualApproval",
      runOrder: 3
    });

    let testBuiltOutput = new codepipeline.Artifact('BuildTestArtifact');
    let builtTestAction=new codepipelineactions.CodeBuildAction({
      actionName: "AMB-CICD-Blog-CodeBuild-CompileDeployTest",
      input: sourceOutput,
      project: codeBuiltGoerliProject,
      runOrder: 4,
      type: codepipelineactions.CodeBuildActionType.BUILD,
      outputs: [testBuiltOutput],
      variablesNamespace:"BuildTesVariables"
    });

    let codePipelineDev=new codepipeline.Pipeline(this, "AMB-CICD-Blog-Dev-CodePipeline", {
      pipelineName: "AMB-CICD-Blog-Dev-CodePipeline",
      stages: [
        {
          stageName:"CodeSource",
          actions:[
            sourceAction
          ]
        },
        {
          stageName:"BuildDevDeploy",
          actions:[
            builtDevAction
          ]
        },
        {
          stageName:"Approve",
          actions:[
            manualApprovalAction
          ]
        },
        {
          stageName:"BuildTestDeploy",
          actions:[
            builtTestAction
          ]
        }
      ],
      artifactBucket: cicdBucket,
      role:codePipelineSvcRole
    });
    codePipelineDev.node.addDependency(appLambdaShareToWinFunc);
  }
}
