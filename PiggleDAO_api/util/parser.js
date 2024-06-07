const HashMap  = require ('hashmap') ;
const { randomFillSync } = require('crypto');

/*  multipart 데이터를 파싱한다.
    input: req
    output: javascript obj - {"code":200, "msg" : "데이터 및 파일 파싱 완료", "dataMap" : dataMap, "fileMap" : fileMap}
*/
function parseMultiParts(req){
    return new Promise( (resolve, reject)=>{
        try{
            // 각파일의 정보를 담은 배열을 저장할 맵
            let fileMap = new HashMap();

            // 파일의 정보를 저장할 배열
            let fileInfoArr;

            let chunksMap = new HashMap();

            // 파일명
            let filetempName;

            // 필드정보를 저장할 해시맵
            let dataMap = new HashMap();

            //텍스트 정보를 읽어와 맵에 저장.
            req.busboy.on('field',(name, value, info) => {
                dataMap.set(name, value);
                console.log("value: " + name , dataMap.get(name));
            });
            
            // 파일 정보를 읽어와서 배열에 저장한다.
            req.busboy.on('file', (name, file, info) => { //파일정보를 읽어온다.
                const { filename, encoding, mimeType } = info;
                
                // 확장자(jpeg, png 등)
                var filetype = mimeType.split("/")[1];

                // mime타입(image/jpeg 등)
                console.log(`File [${name}]: filename: %j, encoding: %j, mimeType: %j`,filename, encoding, mimeType);
                
                file.on('data', function(data) {
                    let chunks = [];
                    // you will get chunks here will pull all chunk to an array and later concat it.
                    chunks.push(data)
                    // 마지막 파일의 data는 두번 저장되고 두번째건 쓰레기 데이터다(이유는 파악 못함). 따라서 데이터가 저장돼있지 않은 경우에만 저장한다.
                    if(chunksMap.get(filename) == undefined){
                        chunksMap.set(filename, chunks);
                    }
                });

                file.on('end', function(data) {
                    // 각 파일의 정보를 저장할 배열
                    fileInfoArr = [];
                    //랜덤하게 파일명 생성
                    filetempName = `${random()}.${filetype}`;
                    // 랜덤한 파일명 저장
                    fileInfoArr[0] = filetempName;
                    // 각 파일의 타입 저장
                    fileInfoArr[1] = mimeType;
                    // 각 파일의 청크 배열 저장
                    fileInfoArr[2] = chunksMap.get(filename);

                    //console.log("데이터 - " + filename)
                    //console.log(chunksMap.get(filename))
                    
                    // you will get chunks here will pull all chunk to an array and later concat it.
                    fileMap.set(filename, fileInfoArr);
                });

            });

            // field와 file스트림에서 데이터를 다 저장하고 마지막으로 실행됨.
            req.busboy.on('finish', function() {
                // 파일배열의 길이(맵인 경우 size로 구해야 함!!)
                const fileLength = fileMap.size;
                
                console.log("파일길이!! => " + fileLength);

                // 정적파일이 있을 때만 fileMap속성에 값을 넣는다.
                if(fileLength != 0) {
                    return resolve({"code":200, "msg" : "데이터 및 파일 파싱 완료", "dataMap" : dataMap, "fileMap" : fileMap})
                }else {
                    return resolve({"code":200, "msg" : "데이터 파싱 완료", "dataMap" : dataMap, "fileMap" : null})
                }

            });

            // 데이터 스트림 만듬
            req.pipe(req.busboy);
        } catch(err) {
            return reject({"code":500, "msg" : "데이터 파싱 실패", "error": "" + err});
        }
    })
}

// 랜덤한 16자리 값을 만든다.
const random = (() => {
    const buf = Buffer.alloc(16);
    return () => randomFillSync(buf).toString('hex');
})();

/* form 데이터를 파싱한다(텍스트만 있다).
    input: req
    output: hashMap <= 필드데이터가 key, value로 저장되어있음
*/
function parseFormData(req){
    return new Promise( (resolve)=>{
        try{
            // 필드정보를 저장할 해시맵
            let dataMap = new HashMap();

            // 데이터 스트림 만듬
            req.pipe(req.busboy);

            //텍스트 정보를 읽어와 맵에 저장.
            req.busboy.on('field',(name, value, info) => {
                if(name.includes("mentioned_user_id_list[]")) {
                    arr.push(value);
                } else {
                    dataMap.set(name, value);
                    console.log("value: " + name , dataMap.get(name));
                }
            });

            req.busboy.on("finish", function() {
                return resolve({"code":200, "msg" : "데이터 파싱 완료", "dataMap" : dataMap});  
            });
        } catch(err){
            return resolve({"code":500, "msg" : "데이터 파싱 실패", "error" : "" + err});
        }
    })
  }

module.exports = {parseMultiParts}