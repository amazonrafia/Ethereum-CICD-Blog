import { DataSyncClient, StartTaskExecutionCommand } from "@aws-sdk/client-datasync";

export const handler = async (event) => {
	let region = process.env.STACK_REGION;
	let taskArn= process.env.TASK_ARN;
	let client = new DataSyncClient({ region });
	let command = new StartTaskExecutionCommand({ TaskArn: taskArn });
	
	let requestType=event["RequestType"];
	
	try{
		let responseBody={};
		if(requestType==="Create" || requestType==="Update"){
			let resourceEventResponse=await client.send(command);
			responseBody["Status"]='SUCCESS';
			responseBody["Reason"]="Files Copied from S3 to EFS";
			responseBody["Data"]={'TaskExecutionArn':resourceEventResponse['TaskExecutionArn']};
		}
		if(requestType==="Delete" || requestType==="Update"){
			responseBody["PhysicalResourceId"]=event["PhysicalResourceId"];
		}
		else{
			responseBody["PhysicalResourceId"]=responseBody.RequestId;
		}
		return responseBody;
	}
	catch(err){
		return {"Status":'FAILED',"Reason":JSON.stringify(err)};
	}
}