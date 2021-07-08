import { Construct, Stage, StageProps } from '@aws-cdk/core';
import { MobileConf } from './context-helper';
import { RepoAppPipelineStack } from './repo-app-pipeline-stack';

interface CloudDeployProps extends StageProps {
  cacheBucketArn?: string,
}

/**
 * Deployable unit of entire architecture
 */
export class CloudDeployStage extends Stage {

  constructor(scope: Construct, id: string, cloudDeployProps?: CloudDeployProps) {
    super(scope, id, cloudDeployProps);
    const mobileContext = this.node.tryGetContext('mobile');
    const mobileConf = mobileContext as MobileConf;
    new RepoAppPipelineStack(this, 'IosPipeline', {
      ...mobileConf.ios.pipeline,
      cacheBucketArn: cloudDeployProps?.cacheBucketArn,
    });
  }

}
