const express = require("express");
const busboy = require('connect-busboy');

const smartcontrctRouter = require("../smartcontract/smartcontractRouter.js");
const userInfoRouter = require("../userInfo/userInfoRouter");
const forecastRouter = require("../forecast/forecastRouter");
const communicationOperationRouter = require("../communityOperation/communicationOperationRouter");
const analysisRouter = require("../analysis/analysisRouter");
const commentRouter = require("../comment/commentRouter");
const tokenRouter = require("../token/tokenRouter");
require("../scheduler/scheduler");

module.exports = function(app) {
  // 경로를 지정하지 않았으므로 모든 요청마다 적용되는 함수이다.!!!!!!!
  // form데이터와 multipart를 처리하기 위해 사용
  app.use(busboy());
  // json형태의 요청을 처리하기 위해 사용
  app.use(express.json());

  app.use("/smartcontrct", smartcontrctRouter);
  app.use("/userinfo", userInfoRouter);
  app.use("/forecast", forecastRouter);
  app.use("/communicationOperation", communicationOperationRouter);
  app.use("/analysis", analysisRouter);
  app.use("/comment", commentRouter);
  app.use("/token", tokenRouter);
  
};