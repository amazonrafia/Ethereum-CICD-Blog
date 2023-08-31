import fs from 'fs';

export const handler = async (event) => {
	let responseBody={
		"IsComplete":false
	};

	if(event["RequestType"]=="Delete"){
		responseBody["IsComplete"]=true;
	}
	else{
		let dir1 ='/mnt/efs/config';
		let dir2 = '/mnt/efs/log';
		let dir3 = '/mnt/efs/Node-1';
		let dir4 = '/mnt/efs/Node-1/data';
	
		if (fs.existsSync(dir1) && fs.existsSync(dir2) && fs.existsSync(dir3) && fs.existsSync(dir4)) {
			responseBody["IsComplete"]=true;
		}
	}
	return responseBody;
}