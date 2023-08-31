import { DataSyncClient, DescribeTaskCommand  } from "@aws-sdk/client-datasync";

export const handler = async (event) => {
	let region = process.env.STACK_REGION;
	let taskArn= process.env.TASK_ARN;
	let responseBody = {
		"PhysicalResourceId":event["PhysicalResourceId"]
	}

	if(event["RequestType"]=="Delete"){
		responseBody["IsComplete"]=true;
	}
	else{
		
		let client = new DataSyncClient({ region });
		let command = new DescribeTaskCommand ({ TaskArn: taskArn });
		try{
			let resourceEventResponse=await client.send(command);
			if(resourceEventResponse.Status=="AVAILABLE"){
				responseBody["IsComplete"]=true;
			}
			else{
				responseBody["IsComplete"]=false;
			}
		}
		catch(err){
			throw err;
		}
	}
	
	return responseBody;
}

