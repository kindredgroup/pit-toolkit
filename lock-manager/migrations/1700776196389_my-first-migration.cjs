
const pg = require('pg');

let getPoolConfig = ()=>{
    let host = process.env["PGHOST"] ||  "localhost";
    let port = process.env["PGPORT"] || 5432;
  
    let user = process.env["PGUSER"] ||  "admin";
    let password = process.env["PGPASSWORD"] || "admin";
    let database = process.env["PGDATABASE"] ||  "lock_manager" ;
    let poolSizeMax = process.env["PGMAXPOOLSIZE"] || 10;
    let poolSizeMin = process.env["PGMINPOOLSIZE"] || 10;
    // connection string
    // return `postgres://${user}:${password}@${hostName}:${port}/${db}`;
  
    const config = {
      user,
      host,
      database,
      password,
      port,
      min: poolSizeMin,
    };
    return config;
  }


  

exports.up = pgm => {

    pgm.createTable('manage_locks', {
        lock_id: {type: 'varchar(255)', primaryKey: true},
        lock_metadata: {
            type: 'jsonb',
            notNull: true,
        },
    });
    //create Index
    pgm.createIndex('manage_locks', 'lock_id');
};

exports.down = pgm => {
    pgm.dropTable('manage_locks');
};

exports.test = ()  => {
    console.log("test migration");
}
