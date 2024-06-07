const mysql = require('mysql');
const config = require('./config');

// 커넥션풀 세팅
const settingObj = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.connectionLimit
}

module.exports = (function () {
    try{
        let dbPool;
    
        const initiate = async () => {
            return mysql.createPool(settingObj)
        }
    
        return {
            getPool: async function () {
                if (!dbPool) {
                    dbPool = await initiate();
                    return dbPool
                }
                else return dbPool;
            }
        }
    } catch(err){
        console.log(err);
    }
})();