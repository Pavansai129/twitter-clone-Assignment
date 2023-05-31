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

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtToken = authHeader.split(" ")[1];
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          next();
        }
      });
    }
  }
};

//API 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const selectUserQuery = `
    SELECT username FROM user WHERE username = "${username}";
    `;
  const isUserAlreadyExists = await db.get(selectUserQuery);
  if (isUserAlreadyExists.username !== undefined) {
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

//API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = "${username}";
    `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const queryToGetlatestTweetsOfThePeopleWhomTheUserFollows = `
  SELECT 
    user.username, tweet.tweet, tweet.date_time AS dateTime  
  FROM 
    user INNER JOIN follower ON user.user_id = follower.follower_user_id
    INNER JOIN tweet ON follower.follower_user_id = tweet.user_id
  WHERE 
    follower.following_user_id = (SELECT follower.following_user_id FROM 
        user INNER JOIN follower ON user.user_id = follower.follower_user_id
    INNER JOIN tweet ON follower.follower_user_id = tweet.user_id
        WHERE user.username = "${request.username}")
  ORDER BY
        tweet.date_time DESC
  LIMIT 4
  OFFSET 0;
  `;
  const latestFourTweets = await db.all(
    queryToGetlatestTweetsOfThePeopleWhomTheUserFollows
  );
  response.send(latestFourTweets);
});
