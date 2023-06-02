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
  const getUserIdQuery = `
  SELECT
    user_id 
  FROM
    user
  WHERE
    username = "${request.username}";
  `;
  let userId = await db.get(getUserIdQuery);
  userId = userId.user_id;
  let userFollowingUsernameAndTweetAndDateTime;
  const userFollowingUsernameAndTweetAndDateTimeQuery = `
   SELECT
    user.username, tweet.tweet, tweet.date_time AS dateTime
  FROM
    user INNER JOIN follower ON user.user_id = follower.following_user_id INNER JOIN tweet ON follower.following_user_id = tweet.user_id
  WHERE 
    follower.follower_user_id = ${userId};
  LIMIT 4
  OFFSET 0
   `;
  userFollowingUsernameAndTweetAndDateTime = await db.all(
    userFollowingUsernameAndTweetAndDateTimeQuery
  );
  response.send(userFollowingUsernameAndTweetAndDateTime);
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
  console.log(tweetId);
  console.log(typeof tweetId);
  let userFollowingIds;
  const userFollowingIdsQuery = `
  SELECT
    following_user_id
  FROM
    follower
  WHERE
    follower_user_id = (SELECT user_id FROM user WHERE username = "${request.username}");
  `;
  userFollowingIds = await db.all(userFollowingIdsQuery);
  userFollowingIds = userFollowingIds.map((each) => each.following_user_id);
  console.log(userFollowingIds);
  const userFollowingTweetIdsQuery = `
  SELECT
    tweet_id
  FROM
    tweet
  WHERE
    user_id IN (SELECT
    following_user_id
  FROM
    follower
  WHERE
    follower_user_id = (SELECT user_id FROM user WHERE username = "${request.username}"));
  `;
  let userFollowingTweetIds = await db.all(userFollowingTweetIdsQuery);
  userFollowingTweetIds = userFollowingTweetIds.map((each) => each.tweet_id);
  console.log(userFollowingTweetIds);
  console.log(userFollowingTweetIds[0]);
  console.log(typeof userFollowingTweetIds[0]);
  let userFollowingTweetAndDateTime;
  let userFollowingTweetAndDateTimeQuery;
  let userFollowingTweetLikes;
  let userFollowingTweetLikesQuery;
  let userFollowingTweetReplies;
  let userFollowingTweetRepliesQuery;
  console.log(userFollowingTweetIds.includes(tweetId));
  if (userFollowingTweetIds.includes(tweetId)) {
    userFollowingTweetAndDateTimeQuery = `SELECT tweet, date_time AS dateTime FROM tweet WHERE tweet_id = ${tweetId}`;
    userFollowingTweetAndDateTime = await db.get(
      userFollowingTweetAndDateTimeQuery
    );
    console.log(userFollowingTweetAndDateTime);
    userFollowingTweetLikesQuery = `SELECT COUNT(*) AS likes FROM like WHERE tweet_id = ${tweetId}`;
    userFollowingTweetLikes = await db.get(userFollowingTweetLikesQuery);
    console.log(userFollowingTweetLikes);
    userFollowingTweetRepliesQuery = `SELECT Count(*) AS replies FROM reply WHERE tweet_id = ${tweetId}`;
    userFollowingTweetReplies = await db.get(userFollowingTweetRepliesQuery);
    console.log(userFollowingTweetReplies);
    response.send({
      tweet: userFollowingTweetAndDateTime.tweet,
      likes: userFollowingTweetLikes.likes,
      replies: userFollowingTweetReplies.replies,
      dateTime: userFollowingTweetAndDateTime.dateTime,
    });
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API 7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    let { tweetId } = request.params;
    tweetId = parseInt(tweetId);
    console.log(tweetId);
    console.log(typeof tweetId);
    let userFollowingIds;
    const userFollowingIdsQuery = `
  SELECT
    following_user_id
  FROM
    follower
  WHERE
    follower_user_id = (SELECT user_id FROM user WHERE username = "${request.username}");
  `;
    userFollowingIds = await db.all(userFollowingIdsQuery);
    userFollowingIds = userFollowingIds.map((each) => each.following_user_id);
    console.log(userFollowingIds);
    const userFollowingTweetIdsQuery = `
  SELECT
    tweet_id
  FROM
    tweet
  WHERE
    user_id IN (SELECT
    following_user_id
  FROM
    follower
  WHERE
    follower_user_id = (SELECT user_id FROM user WHERE username = "${request.username}"));
  `;
    let userFollowingTweetIds = await db.all(userFollowingTweetIdsQuery);
    userFollowingTweetIds = userFollowingTweetIds.map((each) => each.tweet_id);
    console.log(userFollowingTweetIds);
    console.log(userFollowingTweetIds[0]);
    console.log(typeof userFollowingTweetIds[0]);
    let userFollowingTweetLikes;
    let userFollowingTweetLikesQuery;
    let userIdsWhoLikedUserFollowingTweet;
    let userIdsWhoLikedUserFollowingTweetQuery;
    let userNamesWhoLikedUserFollowingTweet;
    let userNamesWhoLikedUserFollowingTweetQuery;
    console.log(userFollowingTweetIds.includes(tweetId));
    if (userFollowingTweetIds.includes(tweetId)) {
      userIdsWhoLikedUserFollowingTweetQuery = `
    SELECT user_id FROM like WHERE tweet_id = ${tweetId};
    `;
      userIdsWhoLikedUserFollowingTweet = await db.all(
        userIdsWhoLikedUserFollowingTweetQuery
      );
      userIdsWhoLikedUserFollowingTweet = userIdsWhoLikedUserFollowingTweet.map(
        (each) => each.user_id
      );
      console.log(userIdsWhoLikedUserFollowingTweet);
      userNamesWhoLikedUserFollowingTweetQuery = `
        SELECT  
            username
        FROM
            user
        WHERE
            user_id IN (${userIdsWhoLikedUserFollowingTweet});
        `;
      userNamesWhoLikedUserFollowingTweet = await db.all(
        userNamesWhoLikedUserFollowingTweetQuery
      );
      userNamesWhoLikedUserFollowingTweet = userNamesWhoLikedUserFollowingTweet.map(
        (each) => each.username
      );
      response.send({ likes: userNamesWhoLikedUserFollowingTweet });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    let { tweetId } = request.params;
    tweetId = parseInt(tweetId);
    let userFollowingIds;
    const userFollowingIdsQuery = `
  SELECT
    following_user_id
  FROM
    follower
  WHERE
    follower_user_id = (SELECT user_id FROM user WHERE username = "${request.username}");
  `;
    userFollowingIds = await db.all(userFollowingIdsQuery);
    userFollowingIds = userFollowingIds.map((each) => each.following_user_id);
    const userFollowingTweetIdsQuery = `
  SELECT
    tweet_id
  FROM
    tweet
  WHERE
    user_id IN (SELECT
    following_user_id
  FROM
    follower
  WHERE
    follower_user_id = (SELECT user_id FROM user WHERE username = "${request.username}"));
  `;
    let userFollowingTweetIds = await db.all(userFollowingTweetIdsQuery);
    userFollowingTweetIds = userFollowingTweetIds.map((each) => each.tweet_id);
    let nameAndReplyOfUserFollowingTweetQuery;
    let nameAndReplyOfUserFollowingTweet;
    if (userFollowingTweetIds.includes(tweetId)) {
      nameAndReplyOfUserFollowingTweetQuery = `
        SELECT
            user.name, reply.reply
        FROM
            user INNER JOIN reply ON user.user_id = reply.user_id
        WHERE
            reply.tweet_id = ${tweetId};
        `;
      nameAndReplyOfUserFollowingTweet = await db.all(
        nameAndReplyOfUserFollowingTweetQuery
      );
      response.send({ replies: nameAndReplyOfUserFollowingTweet });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const userTweetIdsQuery = `
    SELECT 
        tweet_id
    FROM
        tweet
    WHERE
        user_id = (SELECT user_id FROM user WHERE username = "${request.username}");
    `;
  let userTweetIds = await db.all(userTweetIdsQuery);
  userTweetIds = userTweetIds.map((each) => each.tweet_id);
  console.log(userTweetIds);
  const userTweetDetails = [];
  let tweet;
  let likes;
  let replies;
  let dateTime;
  let userTweet;
  let userTweetQuery;
  let userLikes;
  let userTweetLikesQuery;
  let userReplies;
  let userTweetRepliesQuery;
  let userTweetDateTime;
  let userTweetDateTimeQuery;
  for (let eachTweetId of userTweetIds) {
    userTweetQuery = `
      SELECT tweet FROM tweet WHERE tweet_id = ${eachTweetId};
      `;
    userTweetLikesQuery = `
    SELECT COUNT(*) AS likes FROM like WHERE tweet_id = ${eachTweetId};
    `;
    userTweetRepliesQuery = `
    SELECT COUNT(*) AS replies FROM reply WHERE tweet_id = ${eachTweetId};
    `;
    userTweetDateTimeQuery = `
    SELECT date_time AS dateTime FROM tweet WHERE tweet_id = ${eachTweetId};
    `;
    userTweet = await db.get(userTweetQuery);
    console.log(userTweet);
    likes = await db.get(userTweetLikesQuery);
    console.log(likes);
    replies = await db.get(userTweetRepliesQuery);
    console.log(replies);
    userTweetDateTime = await db.get(userTweetDateTimeQuery);
    console.log(userTweetDateTime);
    userTweetDetails.push({
      tweet: userTweet.tweet,
      likes: likes.likes,
      replies: replies.replies,
      dateTime: userTweetDateTime.dateTime,
    });
  }
  response.send(userTweetDetails);
});

//API 10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  let userId;
  const getUserIdQuery = `
    SELECT
        user_id
    FROM
        user
    WHERE
        username = "${request.username}";
    `;
  userId = await db.get(getUserIdQuery);
  userId = userId.user_id;
  const addUserTweetQuery = `
  INSERT INTO
    tweet (tweet, user_id)
  VALUES
    ("${tweet}", ${userId})
  `;
  await db.run(addUserTweetQuery);
  response.send("Created a Tweet");
});

app.delete("/tweets/:tweetId", authenticateToken, async (request, response) => {
  let { tweetId } = request.params;
  tweetId = parseInt(tweetId);
  const getUserTweetsQuery = `
  SELECT
    tweet_id
  FROM
    tweet
  WHERE
    user_id = (
        SELECT
            user_id
        FROM
            user
        WHERE
            username = "${request.username}"
    );
  `;
  let userTweetIds = await db.all(getUserTweetsQuery);
  userTweetIds = userTweetIds.map((each) => each.tweet_id);
  if (userTweetIds.includes(tweetId)) {
    const deleteUserTweetQuery = `
      DELETE FROM
        tweet
      WHERE
        tweet_id = ${tweetId};
      `;
    await db.run(deleteUserTweetQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
