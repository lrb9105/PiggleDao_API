const ipfsAPI = require('ipfs-api')
// connect to ipfs daemon API server
let ipfs = ipfsAPI('localhost', '5001', {protocol: 'http'}) // leaving out the arguments will default to these values

// 설정파일
const fs = require('fs');
const path = require('path');
const jsonFile = fs.readFileSync(path.resolve(__dirname, "../smartcontract/config.json"));
const configJson = JSON.parse(jsonFile);

let ipfsGatewayAddress = configJson.ipfs_gateway;

// ipfs에 이미지 업로드
function uploadImageToIpfs(fileMap){
    return new Promise( (resolve)=>{
        try{
            // 파일을 저장한 맵의 사이즈
            const size = fileMap.size;

            // 파일맵 요소의 카운트
            let count = 1;

            // 파일들의 해시를 ","로 연결해서 저장한 변수
            let fileHashs = "";

            console.log("파일크기: " + size);

            // 파일 갯수만큼 순환
            fileMap.forEach(function (value, key, map) {
                try{
                    let fileBuffer = Buffer.concat(value[2]);

                    // ipfs에 저장
                    ipfs.files.add(fileBuffer, (err,file)=>{
                        // 에러 발생 시 반환
                        if(err) {
                            console.log(err);
                            return resolve({"code":500, "msg" : "ipfs에 파일저장 중 에러 발생", "error" : "" + err});
                        }

                        console.log(file);

                        // 파일 names에 cid 저장
                        // 저장한 cid명 ','로 구분해서 저장
                        fileHashs += file[0].hash + ",";

                        // 마지막이라면 리턴
                        if(count == size){
                            fileHashs = fileHashs.substring(0,fileHashs.length - 1);
                            
                            console.log(fileHashs);

                            return resolve({"code":200, "msg" : "ipfs에 파일저장 완료", "fileHashs" : fileHashs})
                        } else {
                            count++;
                        }
                    })
                } catch(err){
                    console.log(err);
                    return resolve({"code":500, "msg" : "ipfs에 파일저장 중 에러 발생", "error": "" + err});
                }
            });
        } catch(err) {
            console.log(err)
            return resolve({"code":500, "msg" : "uploadImageToIpfs 에러", "error": "" + err});
        }
    });
}

// ipfs에 파일 업로드
function uploadFileToIpfs(data){
    return new Promise( (resolve)=>{
        try{
            const fileBuffer = Buffer.from(data);

            // ipfs에 저장
            ipfs.files.add(fileBuffer, (err,file)=>{
                // 에러 발생 시 반환
                if(err) {
                    console.log(err);
                    return resolve({"code":500, "msg" : "ipfs에 파일저장 중 에러 발생", "error" : "" + err});
                }

                return resolve({"code":200, "msg" : "ipfs에 파일저장 완료", "fileHash" : file[0].hash})
            })
        } catch(err){
            console.log(err);
            return resolve({"code":500, "msg" : "ipfs에 파일저장 중 에러 발생", "error": "" + err});
        }
    });
}

// 게이트웨이를 통해 데이터에 접근할 수 있도록 http프로토콜 적용
function changeDataToHttp(fileHashArr){
    return new Promise( async (resolve)=>{
        let fileHttpUrlArr = [];
        try{
            for(let i = 0; i < fileHashArr.length; i++ ) {
                let fileHash = fileHashArr[i];
                
                if(fileHash != null && fileHash != "") {
                    // http://ipfs게이트웨이ip/ipfs/ + fileHash
                    fileHash = ipfsGatewayAddress + fileHash;
                }

                // 이미지가 없다면 null을 넣어준다.
                fileHttpUrlArr[i] = fileHash;
            }
            return resolve({"code" : 200, "msg" : "ipfs 데이터 http로 변환 완료", "fileHttpUrlArr": fileHttpUrlArr})
        } catch(err){
            return resolve({"code" : 500, "msg" : "ipfs 데이터 http로 변환 실패", "error": "" + err})
        }
    });
}

// ipfs의 파일 삭제
function deleteFilesFromIpfs(cidArr){
    return new Promise( async (resolve)=>{
        try{
            // 파일 삭제
            if(cidArr != null && cidArr.length > 0 ){
                for(let i = 0; i < cidArr.length; i++ ) {
                    await ipfs.files.rm(cidArr[i])
                }
            }

            return resolve({"code": 200, "msg": "ipfs파일 삭제 완료"})
        } catch(err){
            return resolve({"code": 200, "msg": "ipfs파일 삭제 실패", "error": "" + err})
        }
    });
}

// ipfs의 파일 다운로드
function downloadFileFromIpfs(cid){
    return new Promise( async (resolve)=>{
        try{
            let downloadFile;

            ipfs.files.get(cid, (err,files)=>{
                files.forEach((file) =>{
                    console.log(file.path);
                    
                    // buffer가 들어있음.
                    downloadFile = file.content;
                    return resolve({"code" : 200, "msg" : "ipfs에서 파일 다운로드 성공", "file": downloadFile.toString('utf-8')});
                })
            }) 
        } catch(err) {
            return resolve({"code" : 500, "msg" : "ipfs에서 파일 다운로드 실패", "error": "" + err});
        }
    });
}

module.exports = {
    uploadImageToIpfs,
    uploadFileToIpfs,
    changeDataToHttp,
    deleteFilesFromIpfs,
    downloadFileFromIpfs}