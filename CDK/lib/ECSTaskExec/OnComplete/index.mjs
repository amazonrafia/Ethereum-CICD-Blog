import { ECSClient, DescribeTasksCommand } from "@aws-sdk/client-ecs";
import { EC2Client, DescribeNetworkInterfacesCommand } from "@aws-sdk/client-ec2";

export const handler = async (event) => {
	let region = process.env.STACK_REGION;
	let clusterName = process.env.CLUSTER_NAME;
	let taskStatus = "";
	let taskEni = "";
	let responseBody = {};
	let eniPublicIp;

	if(event["Status"]=="FAILED"){
		responseBody["IsComplete"] = true;
		return responseBody;
	}

	if(event["Data"] == undefined || event["Data"]== null){
		responseBody["IsComplete"] = false;
	}
	else{
		let taskArn = event["Data"]["TaskArn"];
		if(taskArn==""){
			responseBody["IsComplete"] = true;
			return responseBody;
		}
		try {
			let ecsClient = new ECSClient({ region });
			let taskDescribeCommand = new DescribeTasksCommand({
				cluster: clusterName,
				tasks: [taskArn]
			});
			let response = await ecsClient.send(taskDescribeCommand);
			if(event["RequestType"]=="Create" || event["RequestType"]=="Update"){
				let attachDetails = response.tasks[0].attachments[0].details;
				for (let i = 0; i < attachDetails.length; i++) {
					if (attachDetails[i].name == "networkInterfaceId") {
						taskEni = attachDetails[i].value;
						taskStatus = response.tasks[0].lastStatus;
						break;
					}
				}
	
				if (taskStatus == "RUNNING" && taskEni != "") {
					//get the public ip of the task
					let ec2Client = new EC2Client({ region });
	
					let eniDescribeCommand = new DescribeNetworkInterfacesCommand({
						NetworkInterfaceIds: [taskEni]
					});
					let eniResponse = await ec2Client.send(eniDescribeCommand);
					eniPublicIp = eniResponse.NetworkInterfaces[0].Association.PublicIp;
					responseBody["Data"] = { "PublicIp": eniPublicIp };
					responseBody["IsComplete"] = true;
				}
				else {
					responseBody["IsComplete"] = false;
				}
			}
			else{
				if(response.tasks[0].lastStatus=="STOPPED"){
					responseBody["IsComplete"] = true;
				}
				else{
					responseBody["IsComplete"] = false;
				}
			}
		}
		catch (err) {
			throw err;
		}
	}
	return responseBody
}

