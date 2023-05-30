const express = require("express");

const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB error: ${error.message}`);
    proces.exit(1);
  }
};

initializeDbAndServer();

//API 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  console.log(username, password, name, gender);
  const selectUserQuery = `
    SELECT username FROM user WHERE username = "${username}";
    `;
  const isUserAlreadyExists = await db.get(selectUserQuery);
  console.log(isUserAlreadyExists);
  if (isUserAlreadyExists !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const queryToPostData = `
    INSERT INTO
        user (username, password, name, gender)
    VALUES
        ("${username}", "${hashedPassword}", "${name}", "${gender}");
    `;
      await db.run(queryToPostData);
      response.send("User created successfully");
    }
  }
});
