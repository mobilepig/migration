const dotenv = require("dotenv");
const mysql = require("mysql2");

dotenv.config();

const bf_pool = mysql.createPool({
  connectionLimit: 10, // 최대 연결 수
  host: process.env.BF_HOST,
  user: process.env.BF_USER,
  password: process.env.BF_PASSWORD,
  database: process.env.BF_DATABASE,
  port: process.env.BF_PORT,
});

const af_pool = mysql.createPool({
  connectionLimit: 10, // 최대 연결 수
  host: process.env.AF_HOST,
  user: process.env.AF_USER,
  password: process.env.AF_PASSWORD,
  database: process.env.AF_DATABASE,
  port: process.env.AF_PORT,
});

//데이터베이스 연결 확인

const checkDatabaseConnection = (pool) => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        reject(err);
      } else {
        connection.release();
        resolve();
      }
    });
  });
};

const checkAllDatabaseConnections = async () => {
  try {
    await Promise.all([
      checkDatabaseConnection(bf_pool),
      checkDatabaseConnection(af_pool),
    ]);
    console.log(
      "\x1b[48;2;128;0;128m Start \x1b[0m 모든 데이터베이스가 마이그레이션할 준비가 되었습니다!"
    );
    return true;
  } catch (error) {
    // console.error("데이터 베이스가 연결되지 않았습니다.", error);
    console.error("데이터 베이스가 연결되지 않았습니다.");
    return false;
  }
};

checkAllDatabaseConnections();

//테이블 목록
const getTableList = (pool) => {
  return new Promise((resolve, reject) => {
    pool.query("SHOW TABLES", (error, results) => {
      if (error) {
        reject(error);
      } else {
        const tables = results.map((row) => Object.values(row)[0]);
        resolve(tables);
      }
    });
  });
};

const showTableList = async () => {
  try {
    const bfTables = await getTableList(bf_pool);
    console.log(
      "\x1b[48;2;0;0;255m In Progress \x1b[0m 이전 데이터베이스 테이블 목록",
      bfTables
    );
    return bfTables;
  } catch (error) {
    // console.error("테이블 목록 조회에 실패했습니다.", error);
    console.error("테이블 목록 조회에 실패했습니다.");
    return;
  }
};

showTableList();

// 테이블 그대로 만들기

const getTableDefinitions = async (pool) => {
  return new Promise((resolve, reject) => {
    pool.query("SHOW TABLES", (error, results) => {
      if (error) {
        reject(error);
      } else {
        const tables = results.map((row) => Object.values(row)[0]);
        const tableDefinitions = [];
        const promises = tables.map((table) => {
          return new Promise((resolve, reject) => {
            pool.query(`SHOW CREATE TABLE ${table}`, (error, results) => {
              if (error) {
                reject(error);
              } else {
                const createTableStatement = results[0]["Create Table"];
                tableDefinitions.push(createTableStatement);
                resolve();
              }
            });
          });
        });
        Promise.all(promises)
          .then(() => resolve(tableDefinitions))
          .catch(reject);
      }
    });
  });
};

const getTableCreationQueries = async () => {
  try {
    const tableDefinitions = await getTableDefinitions(bf_pool);
    return tableDefinitions;
  } catch (error) {
    // console.error("테이블 생성 쿼리가 실패했습니다.", error);
    console.error("테이블 생성 쿼리가 실패했습니다.");
    return [];
  }
};

const createTableQuery = async () => {
  return await getTableCreationQueries();
};
const makeConditionQuery = async () => {
  const queries = await createTableQuery();
  const modifiedQueries = queries.map((query) => {
    // CREATE TABLE 문에 IF NOT EXISTS 조건 추가
    return query.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS");
  });
  return modifiedQueries;
};

// af 디비에 테이블 만들기
const createTablesInAfDatabase = async (queries) => {
  const connection = await af_pool.promise().getConnection();
  try {
    for (const query of queries) {
      await connection.query(query);
      const tableName = query.match(/`([^`]*)`/)[1];
      console.log(
        `\x1b[48;2;255;255;0m Info \x1b[0m 테이블 ${tableName}가 생성되었습니다.`
      );
    }
    console.log(
      "\x1b[48;2;0;0;255m In Progress \x1b[0m 마이그레이션 후 테이블이 정상적으로 생성되었습니다!"
    );
  } catch (error) {
    console.error("이전할 데이터베이스의 테이블 생성이 실패했습니다.");
  } finally {
    connection.release();
  }
};
const makeTablesToAF = async () => {
  await createTablesInAfDatabase(await makeConditionQuery());
};

// 데이터 순회이동

const moveTableDataFromBFtoAF = async (bfTableName, afTableName) => {
  let success = false; // 초기값은 실패로 설정

  const bfConnection = await bf_pool.promise().getConnection();
  const afConnection = await af_pool.promise().getConnection();

  try {
    let offset = 0;
    const batchSize = 50;
    let bfData = [];

    // BF 데이터베이스에서 데이터를 검색
    while (true) {
      const [rows] = await bfConnection.query(
        `SELECT * FROM ${bfTableName} LIMIT ${offset}, ${batchSize}`
      );
      if (rows.length === 0) break; // 더 이상 데이터가 없으면 종료
      bfData = rows;

      // AF 데이터베이스에 데이터 삽입
      const values = bfData.map((row) => Object.values(row));
      await afConnection.query(`INSERT INTO ${afTableName} VALUES ?`, [values]);

      // 2초 대기
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 오프셋 증가
      offset += batchSize;
      console.log(
        `\x1b[48;2;0;0;255m In Progress \x1b[0m ${bfTableName}테이블의 ${offset}rows까지의 데이터가 이전되었습니다.`
      );
    }

    console.log(`${bfTableName}테이블의 데이터 이동이 완료되었습니다.`);
    success = true; // 성공 시 true로 설정
  } catch (error) {
    // console.error(`데이터 이동 중 오류 발생:`, error);
    console.error(`\x1b[48;2;255;0;0m Fail \x1b[0m 데이터 이동 중 오류 발생`);
    console.log(
      `\x1b[48;2;255;255;0m Info \x1b[0m 에러 발생으로 인해 ${afTableName} 테이블의 모든 데이터를 삭제합니다.`
    );
    await afConnection.query(`DELETE FROM ${afTableName}`);
  } finally {
    bfConnection.release();
    afConnection.release();
    return success; // 성공 또는 실패 여부 반환
  }
};

// 데이터 이동

const migration = async () => {
  try {
    await makeTablesToAF();
    const tableLists = await getTableList(bf_pool);

    for (const table of tableLists) {
      const success = await moveTableDataFromBFtoAF(table, table);
      if (!success) {
        console.log(
          `\x1b[48;2;255;0;0m Fail \x1b[0m 테이블 ${table}의 데이터 마이그레이션 실패`
        );
        await clearAllTablesData(); // 모든 테이블의 데이터를 삭제
        return;
      }
    }

    console.log(
      "\x1b[48;2;0;255;0m Success \x1b[0m 모든 테이블의 데이터 마이그레이션이 완료되었습니다."
    );
  } catch (error) {
    console.error(
      "\x1b[48;2;255;0;0m Fail \x1b[0m 마이그레이션 중 오류 발생:",
      error
    );
  }
};

const clearAllTablesData = async () => {
  const tableLists = await getTableList(af_pool);
  for (const table of tableLists) {
    await af_pool.promise().query(`DELETE FROM ${table}`);
    console.log(
      `\x1b[48;2;255;0;0m Fail \x1b[0m ${table} 테이블의 데이터가 모두 삭제되었습니다.`
    );
  }
};

migration();
