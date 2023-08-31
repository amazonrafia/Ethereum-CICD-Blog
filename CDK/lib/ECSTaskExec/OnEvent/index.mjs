import { ECSClient, RunTaskCommand,StopTaskCommand,ListTasksCommand,DescribeTasksCommand} from "@aws-sdk/client-ecs";

export const handler = async (event) => {
	let region = process.env.STACK_REGION;
	let clusterName = process.env.CLUSTER_NAME;
	let taskDefArn = process.env.TASK_DEF_ARN;
	let taskSubnetID = process.env.TASK_SUBNETID;
	let secGroupID = process.env.SEC_GROUP_ID;
	let taskArn = "";

	let ecsClient = new ECSClient({ region });
	let requestType=event["RequestType"];
	let responseBody = {};

	try{
		if(requestType==="Create"){
			let taskStartCommand = new RunTaskCommand({ 
				cluster:clusterName,
				taskDefinition:taskDefArn,
				count:1,
				launchType: "FARGATE",
				networkConfiguration: { // NetworkConfiguration
					awsvpcConfiguration: { // AwsVpcConfiguration
						subnets: [ // StringList // required
							taskSubnetID
						],
						securityGroups: [
							secGroupID
						],
						assignPublicIp: "ENABLED",
					},
				},
				startedBy:"CICD-Blog-CustomResource"
			});
			let resourceEventResponse=await ecsClient.send(taskStartCommand);
			taskArn=resourceEventResponse.tasks[0].taskArn;
			
			responseBody["Data"]={'TaskArn':taskArn};
			responseBody["Reason"]="Besu Node Creation Task Started";
			
			
		}	
		if(requestType==="Update"){
			let taskStatus;
			let taskListCommand = new ListTasksCommand({
				cluster:clusterName,
				desiredStatus:"RUNNING",
				launchType:"FARGATE"
			});
			let taskList=(await ecsClient.send(taskListCommand)).taskArns;
			for(let i=0;i<taskList.length;i++){
				let taskDescribeCommand = new DescribeTasksCommand({
					cluster:clusterName,
					tasks: [taskList[i]],
					include: ["TAGS"]
				});
				let response = await ecsClient.send(taskDescribeCommand);
				let startedby=response.tasks[0].startedBy;
				if(startedby=="CICD-Blog-CustomResource"){
					taskArn=taskList[i];
					taskStatus = response.tasks[0].lastStatus;
					break;
				}
			}
			if (taskStatus != "RUNNING" || taskArn==""){
				let taskStartCommand = new RunTaskCommand({ 
					cluster:clusterName,
					taskDefinition:taskDefArn,
					count:1,
					launchType: "FARGATE",
					networkConfiguration: { // NetworkConfiguration
						awsvpcConfiguration: { // AwsVpcConfiguration
							subnets: [ // StringList // required
								taskSubnetID
							],
							securityGroups: [
								secGroupID
							],
							assignPublicIp: "ENABLED",
						},
					},
					startedBy:"CICD-Blog-CustomResource"
				});
				let resourceEventResponse=await ecsClient.send(taskStartCommand);
				taskArn=resourceEventResponse.tasks[0].taskArn;
			
				responseBody["Data"]={'TaskArn':taskArn};
				responseBody["Reason"]="Besu Node Creation Task Started";
			}
			else{
				responseBody["Data"]={'TaskArn':taskArn};
				responseBody["Reason"]="Besu Node is running";
			}
		}
		if(requestType==="Delete"){
			//get task arn identified by the tag
			let taskListCommand = new ListTasksCommand({
				cluster:clusterName,
				desiredStatus:"RUNNING",
				launchType:"FARGATE"
			});
			let taskList=(await ecsClient.send(taskListCommand)).taskArns;
			

			for(let i=0;i<taskList.length;i++){
				let taskDescribeCommand = new DescribeTasksCommand({
					cluster:clusterName,
					tasks: [taskList[i]],
					include: ["TAGS"]
				});
				let response = await ecsClient.send(taskDescribeCommand);
				let startedby=response.tasks[0].startedBy;
				if(startedby=="CICD-Blog-CustomResource"){
					taskArn=taskList[i];
					break;
				}
			}
			if(taskArn!=""){
				let taskStopCommand = new StopTaskCommand({
					cluster:clusterName,
					task:taskArn,
					reason:"Besu Node Deletion Task"
				});
				await ecsClient.send(taskStopCommand);	
			}
			responseBody["Data"]={'TaskArn':taskArn};
			responseBody["Reason"]="Besu Node Deletion Task Started";
		}
		responseBody["Status"]='SUCCESS';
		if(requestType==="Create"){
			responseBody["PhysicalResourceId"]=responseBody.RequestId;
		}
		else{
			responseBody["PhysicalResourceId"]=event["PhysicalResourceId"];
		}

		return responseBody;
	}
	catch(err){
		return {"Status":'FAILED',"Reason":JSON.stringify(err)};
	}	
}