import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { Pipeline } from '@aws-cdk/aws-codepipeline';
import { ManualApprovalAction, CodeBuildActionType, S3DeployAction } from '@aws-cdk/aws-codepipeline-actions';
import { PipelineConf } from './context-helper';
import { buildRepoSourceAction, buildDroidBuildAction, buildCustomAction } from './pipeline-helper'

export interface RepoAppPipelineProps extends StackProps, PipelineConf {
  cacheBucketArn?: string,
}

export class RepoAppPipelineStack extends Stack {

  constructor(scope: Construct, id: string, repoAppPipelineProps: RepoAppPipelineProps) {
    super(scope, id, repoAppPipelineProps);
    let cacheBucket;
    if (repoAppPipelineProps.cacheBucketArn) {
      cacheBucket = Bucket.fromBucketArn(this, 'CacheBucket', repoAppPipelineProps.cacheBucketArn);
    } else {
      cacheBucket = new Bucket(this, 'CacheBucket');
    };
    const pipelineStages = [];
    const { action: repoAction, sourceCode } = buildRepoSourceAction(this, {
      ...repoAppPipelineProps.repo,
    });
    const sourceStage = {
      stageName: 'Source',
      actions: [
        repoAction,
      ],
    };
    pipelineStages.push(sourceStage);
    const prefix = id + 'Build';
    const { action: buildAction, apkFiles } = buildDroidBuildAction(this, {
      ...repoAppPipelineProps.build,
      prefix,
      sourceCode,
      cacheBucket,
    });
    const buildStage = {
      stageName: 'Build',
      actions: [
        buildAction,
      ],
    };
    pipelineStages.push(buildStage);
    /* Todo:
     * optional stages (in order from build) - staging (register-task-definition), deploy, staging cleanup (stop task)
     */
    if (repoAppPipelineProps.test) {
      const prefix = id + 'Test';
      const { action: testAction } =  buildCustomAction(this, {
        ...repoAppPipelineProps.test,
        prefix,
        type: CodeBuildActionType.TEST,
        input: sourceCode,
        cacheBucket,
      });
      const testStage = {
        stageName: 'Test',
        actions: [
          testAction,
        ],
      };
      pipelineStages.push(testStage);
    };
    if (repoAppPipelineProps.validate) {
      const approvalAction = new ManualApprovalAction({
        actionName: 'Approval',
        notifyEmails: repoAppPipelineProps.validate.emails,
      });
      const validateStage = {
        stageName: 'Validate',
        actions: [
          approvalAction,
        ],
      };
      pipelineStages.push(validateStage);
    };
    if (repoAppPipelineProps.deploy) {
      const deployBucket = new Bucket(this, 'DeployBucket');
      const deployAction = new S3DeployAction({
        actionName: 'S3Deploy',
        input: apkFiles,
        bucket: deployBucket,
      });
      const deployStage = {
        stageName: 'Deploy',
        actions: [
          deployAction,
        ],
      };
      pipelineStages.push(deployStage);  
    }
    // const deployPolicy = new PolicyStatement({
    //   effect: Effect.ALLOW,
    //   actions: [
    //     'lambda:UpdateFunctionCode',
    //   ],
    //   resources: [
    //     repoAppPipelineProps.func.functionArn,
    //   ],
    // });
    // const deployCode = Code.fromAsset(join(__dirname, 'sls-cont-deploy-handler'));
    // const deployHandler = new Function(this, 'DeployHandler', {
    //   runtime: Runtime.PYTHON_3_8,
    //   handler: 'slsdeploy.on_event',
    //   code: deployCode,
    //   timeout: Duration.minutes(1),
    //   logRetention: RetentionDays.ONE_DAY,
    //   initialPolicy: [
    //     deployPolicy,
    //   ],
    // });
    // contRepo.grant(deployHandler,
    //   'ecr:SetRepositoryPolicy',
    //   'ecr:GetRepositoryPolicy',
    //   'ecr:InitiateLayerUpload'
    // );
    // const userParameters = {
    //   funcName: repoAppPipelineProps.func.functionName,
    //   repoUri: contRepo.repositoryUri + ':latest',
    // };
    // const slsDeploy = new LambdaInvokeAction({
    //   actionName: 'SlsDeploy',
    //   lambda: deployHandler,
    //   userParameters: deployProps,
    // });
    // const deployStage = {
    //   stageName: 'Deploy',
    //   actions: [
    //     slsDeploy,
    //   ],
    // };
    // pipelineStages.push(deployStage);
    new Pipeline(this, 'RepoAppPipeline', {
      stages: pipelineStages,
      restartExecutionOnUpdate: false,
    });
  }

}
