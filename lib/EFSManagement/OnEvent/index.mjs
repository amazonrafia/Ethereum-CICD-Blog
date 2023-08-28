import fs from 'fs';

let createResource = async (event) => {
	try{
		let dir1 ='/mnt/efs/config';
		let dir2 = '/mnt/efs/log';
		let dir3 = '/mnt/efs/Node-1';
		let dir4 = '/mnt/efs/Node-1/data';

		if (!fs.existsSync(dir1)) {
			fs.mkdirSync(dir1, { recursive: true });
		}
		if (!fs.existsSync(dir2)) {
			fs.mkdirSync(dir2, { recursive: true });
		}
		if (!fs.existsSync(dir3)) {
			fs.mkdirSync(dir3, { recursive: true });
		}
		if (!fs.existsSync(dir4)) {
			fs.mkdirSync(dir4, { recursive: true });
		}
	
		return {"Status":'SUCCESS',"Reason":"Resource was successfully created or updated"};
	}
	catch(err){
		throw err;
	}
}
export const handler = async (event) => {
	let requestType=event["RequestType"];
	
	let responseBody = {
		"StackId" : event["StackId"],
		"RequestId" : event["RequestId"],
		"LogicalResourceId" : event["LogicalResourceId"]
	}
	try{
		if(requestType==="Create" || requestType==="Update"){
			let resourceEventResponse=await createResource(event);
			responseBody["Status"]=resourceEventResponse["Status"];
			responseBody["Reason"]=resourceEventResponse["Reason"];
		}
		
		if(requestType==="Delete" || requestType==="Update"){
			responseBody["PhysicalResourceId"]=event["PhysicalResourceId"];
		}
		else{
			responseBody["PhysicalResourceId"]=responseBody.RequestId;
		}
		if(requestType==="Delete"){
			responseBody["Status"]="SUCCESS";
			responseBody["Reason"]="Resource was successfully deleted";
		}
		return responseBody;
	}
	catch(err){
		return {"Status":'FAILED',"Reason":JSON.stringify(err)};
	}
}