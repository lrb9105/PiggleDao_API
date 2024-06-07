// express.Router를 사용하기 위해 express exports를 가져옴!
const express = require("express");
const blockchain = require('../smartcontract/blockchain');
const parser = require('../util/parser')

// Router를 사용하기 위해 express.Router()호출
const router = express.Router();

router.use(express.urlencoded({ extended: false }));

// 외부에서 사용하기 위해 router를 넣어줌!
module.exports = router;

// piggle => Nova로 변경
router.post('/exchangeToNova',async function(req,res){
    const resultParse = await parser.parseMultiParts(req);

    if(resultParse.code == 500) {
        res.send(resultParse);
        return;
    }

    const dataMap = resultParse.dataMap;

    const result = await blockchain.exchangeToNova(dataMap);

    res.send(result);
});

// piggle => bubble로 변경
router.post('/exchangeToBubble',async function(req,res){
    const resultParse = await parser.parseMultiParts(req);
    if(resultParse.code == 500) {
        res.send(resultParse);
        return;
    }

    const dataMap = resultParse.dataMap;

    const result = await blockchain.exchangeToBubble(dataMap);

    res.send(result);
});