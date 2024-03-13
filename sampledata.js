const dotenv = require("dotenv");
const mysql = require("mysql2");

dotenv.config();

// MySQL Pool 생성
const bf_pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.BF_HOST,
  user: process.env.BF_USER,
  password: process.env.BF_PASSWORD,
  database: process.env.BF_DATABASE,
  port: process.env.BF_PORT,
});

// 랜덤한 숫자를 생성하는 함수
const getRandomNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// 샘플 데이터 생성 함수
const generateSampleData = () => {
  const sampleData = [];
  for (let i = 1; i <= 60; i++) {
    const id = `user${i}`;
    const detail = `Sample detail ${i}`;
    sampleData.push({ id, detail });
  }
  return sampleData;
};

// MySQL에 샘플 데이터 삽입 함수
const insertSampleDataToDatabase = async (sampleData) => {
  const connection = await bf_pool.promise().getConnection();
  try {
    await connection.query(
      "CREATE TABLE IF NOT EXISTS users (user_idx INT AUTO_INCREMENT PRIMARY KEY, id VARCHAR(255) UNIQUE, detail TEXT)"
    );

    // 삽입할 데이터를 배열로 변환
    const values = sampleData.map(({ id, detail }) => [id, detail]);

    // INSERT 쿼리 실행
    await connection.query("INSERT INTO users (id, detail) VALUES ?", [values]);
    console.log("Sample data inserted successfully.");
  } catch (error) {
    console.error("Error inserting sample data:", error);
  } finally {
    connection.release();
  }
};

// 샘플 데이터 생성
const sampleData = generateSampleData();

// 샘플 데이터를 MySQL에 삽입
insertSampleDataToDatabase(sampleData);

// 샘플 데이터 생성 함수
const generateSamplePostData = () => {
  const samplePostData = [];
  for (let i = 1; i <= 110; i++) {
    const title = `Post ${i} Title`;
    const content = `Post ${i} Content`;
    samplePostData.push({ title, content });
  }
  return samplePostData;
};

// MySQL에 샘플 데이터 삽입 함수
const insertSamplePostDataToDatabase = async (samplePostData) => {
  const connection = await bf_pool.promise().getConnection();
  try {
    await connection.query(
      "CREATE TABLE IF NOT EXISTS posts (post_id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255), content TEXT)"
    );

    // 삽입할 데이터를 배열로 변환
    const values = samplePostData.map(({ title, content }) => [title, content]);

    // INSERT 쿼리 실행
    await connection.query("INSERT INTO posts (title, content) VALUES ?", [
      values,
    ]);
    console.log("Sample post data inserted successfully.");
  } catch (error) {
    console.error("Error inserting sample post data:", error);
  } finally {
    connection.release();
  }
};

// 샘플 데이터 생성
const samplePostData = generateSamplePostData();

// 샘플 데이터를 MySQL에 삽입
insertSamplePostDataToDatabase(samplePostData);
