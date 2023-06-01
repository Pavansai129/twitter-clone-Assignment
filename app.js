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
  //query to get the tweets of the people whom the user follows
  const userFeedQuery = `
  SELECT
    user.username, tweet.tweet, tweet.date_time AS dateTime
  FROM 
    user NATURAL JOIN tweet INNER JOIN follower ON tweet.user_id = follower.following_user_id
  WHERE 
    follower.follower_user_id = (
      SELECT 
        user_id
    FROM
        user
    WHERE 
        username = "${request.username}"
  )
  ORDER BY 
    tweet.tweet_id DESC
  LIMIT 4
  OFFSET 0
  ;
  `;
  const userFeed = await db.all(userFeedQuery);
  response.send(userFeed);
});

//API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const userFollowingNamesQuery = `
    SELECT
        name
    FROM 
        user INNER JOIN follower ON user.user_id = follower.following_user_id
    WHERE
        follower.follower_user_id = (
            SELECT
                user_id
            FROM
                user
            WHERE
                username = "${request.username}"
        )
    `;
  const userFollowingNamesList = await db.all(userFollowingNamesQuery);
  response.send(userFollowingNamesList);
});

//API 5
app.get("/user/followers", authenticateToken, async (request, response) => {
  const userFollowersNamesQuery = `
    SELECT 
        name
    FROM
        user INNER JOIN follower ON user.user_id = follower.follower_user_id
    WHERE
        follower.following_user_id = (
            SELECT
                user_id
            FROM 
                user
            WHERE 
                username = "${request.username}"
        );
    `;
  const userFollowersNamesList = await db.all(userFollowersNamesQuery);
  response.send(userFollowersNamesList);
});

//API 6
app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  let { tweetId } = request.params;
  tweetId = parseInt(tweetId);
  const userFollowingTweetsFeedQuery = `
  SELECT 
    DISTINCT tweet.tweet_id
  FROM
    user INNER JOIN tweet ON user.user_id = tweet.user_id INNER JOIN
    follower ON tweet.user_id = follower.following_user_id
  WHERE
    follower.follower_user_id = (
        SELECT 
            user_id
        FROM
            user
        WHERE
            username = "${request.username}"
    );
  `;
  const userFollowingTweetsFeed = await db.all(userFollowingTweetsFeedQuery);
  const userFollowingTweetsFeedList = userFollowingTweetsFeed.map((each) =>
    parseInt(each.tweet_id)
  );
  if (userFollowingTweetsFeedList.includes(tweetId)) {
    const userFollowingTweetsDetails = `
    SELECT
        (SELECT tweet FROM tweet WHERE tweet_id = 7) AS tweet,
        (SELECT COUNT() FROM like WHERE tweet_id = ${tweetId}) AS likes,
        (SELECT COUNT() FROM reply WHERE tweet_id = ${tweetId}) AS replies,
        (SELECT date_time FROM tweet WHERE tweet_id = ${tweetId}) AS dateTime
    FROM
       tweet NATURAL JOIN like NATURAL JOIN reply INNER JOIN follower ON tweet.user_id = follower.following_user_id
    WHERE 
        follower.follower_user_id = (
            SELECT
                user_id
            FROM
                user
            WHERE 
                username = "${request.username}"
            );
    `;
    const specificTweetOfUserFollowingFeed = await db.get(
      userFollowingTweetsDetails
    );
    response.send(specificTweetOfUserFollowingFeed);
  } else {
    response.status(401);
    response.send("Invalid Request...");
  }
});
