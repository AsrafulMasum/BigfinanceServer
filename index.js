require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const cors = require("cors");

const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://bigfinancetask.web.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gb8vxvz.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// jwt middleware
const verifyCookie = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.user = decoded;
    next();
  });
};

// mongodb connection
const dbConnect = async () => {
  try {
    client.connect();
    console.log("DB Connected Successfully✅");
  } catch (error) {
    console.log(error.name, error.message);
  }
};
dbConnect();

const database = client.db("devTownTaskDB");
const usersCollections = database.collection("usersDB");
const playersCollections = database.collection("playersDB");

// jwt api method
app.post("/jwt", (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    })
    .send({ success: true });
});

app.post("/logout", (req, res) => {
  const user = req.body;
  res.clearCookie("token", { maxAge: 0 }).send({ success: true });
});

app.get("/", (req, res) => {
  res.send("server is running data will appear soon...");
});

// users api method
app.post("/users", async (req, res) => {
  try {
    const user = req.body;
    const email = user?.email;
    const query = { email: email };
    const isExists = await usersCollections.findOne(query);
    if (isExists) {
      res.send({ user: "Exist" });
    } else {
      const result = await usersCollections.insertOne(user);
      res.send(result);
    }
  } catch (error) {
    console.error("Error posting users:", error);
    res.status(500).send("Internal server error");
  }
});

// products api method
app.post("/players", verifyCookie, async (req, res) => {
  try {
    const playerInfo = req.body;
    const result = await playersCollections.insertOne(playerInfo);
    res.send(result);
  } catch (error) {
    console.error("Error posting players:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/players", async (req, res) => {
  try {
    const cursor = playersCollections.find();
    const result = await cursor.toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching players:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/players/rank/:val", async (req, res) => {
  try {
    const rank = parseInt(req.params.val)-1;
    const cursor = playersCollections.aggregate([
      { 
        $project: {
          name: 1,
          country: 1,
          score: { $toInt: "$score" }
        }
      },
      { $sort: { score: -1 } }
    ]);

    const result = await cursor.toArray();
    const requestedRank = rank + 1;

    if (requestedRank >= 1 && requestedRank <= result.length) {
      const player = result[requestedRank - 1];
      res.send(player);
    } else {
      res.status(404).send("Player not found");
    }
  } catch (error) {
    console.error("Error fetching players:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/players/random", async (req, res) => {
  try {
    const cursor = playersCollections.aggregate([
      { $sample: { size: 1 } }
    ]);

    const result = await cursor.toArray();

    if (result.length > 0) {
      res.send(result[0]);
    } else {
      res.status(404).send("No players found");
    }
  } catch (error) {
    console.error("Error fetching random player:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/players/:id", verifyCookie, async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await playersCollections.findOne(query);
    res.send(result);
  } catch (error) {
    console.error("Error fetching players:", error);
    res.status(500).send("Internal server error");
  }
});

app.put("/players/:id", verifyCookie, async (req, res) => {
  try {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const options = { upsert: true };
    const updatePlayer = {
      $set: {
        name: req.body.name,
        country: req.body.country,
        score: req.body.score,
      },
    };
    const result = await playersCollections.updateOne(
      filter,
      updatePlayer,
      options
    );
    res.send(result);
  } catch (error) {
    console.error("Error updating players:", error);
    res.status(500).send("Internal server error");
  }
});

app.delete("/players/:id", verifyCookie, async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await playersCollections.deleteOne(query);
    res.send(result);
  } catch (error) {
    console.error("Error deleting players:", error);
    res.status(500).send("Internal server error");
  }
});

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
});
