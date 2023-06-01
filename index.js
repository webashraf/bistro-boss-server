const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;
const JWT_SECRETE_TOKEN = process.env.JWT_SECRETE_TOKEN || "";



// Middle were //
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  // console.log(authorization);
  if (!authorization) {
    console.log("Fast error");
    return res.status(401).send( {error: true, message: "unauthorized access"});
  }
  else{

    const token = authorization.split(' ')[1];
    console.log("token222________", JWT_SECRETE_TOKEN);


    jwt.verify(token, JWT_SECRETE_TOKEN, (error, decoded) => {
      // console.log("Errrrrrrrrrrrrrrrrrrrror", error);
      if (error) {
        console.log("Second error", error);
        return res.status(401).send({error: true, message: error});
      }

      req.decoded = decoded;
      next()
    })
  }
}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.37yfgb3.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const userCollection = client.db("bistroBossDb").collection("user");
    const menuCollection = client.db("bistroBossDb").collection("menu");
    const reviewsCollection = client.db("bistroBossDb").collection("reviews");
    const cartsCollection = client.db("bistroBossDb").collection("carts");

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, JWT_SECRETE_TOKEN, {expiresIn: '1hr'});
      res.send({token})
    })

    // User collection data management //
    app.get('/users', async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.send(result);
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) =>{
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.status(403).send({error: true, message: 'Invalid email'});
      }


      const query = {email: email};
      const user = await userCollection.findOne(query);
      const result = {admin: user?.role === 'admin'};
      res.send(result);
    })

    app.post('/user', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send("user already exists");
      }
      else {
        const result = await userCollection.insertOne(user);
        res.send(result);
      }
    })

    app.patch('/user/admin/:id', async (req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedAdmin = {
        $set: {
          role: "admin"
        }
      }
      const result = await userCollection.updateOne(filter, updatedAdmin);
      res.send(result);
    })



    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })

    app.get('/reviews', async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    })


    // Cart collection //
    app.get('/carts', verifyJWT,async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      const decodedEmail = req.decoded.email;
      if (!decodedEmail) {
        return res.status(403).send({error: true, message: "forbidden access"})
        console.log("third error");
      }
      const query = { email: email }
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });
    app.post('/carts', async (req, res) => {
      const data = req.body;
      // console.log(data);
      const result = await cartsCollection.insertOne(data);
      res.send(result);
    })
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






























app.get('/', (req, res) => {
  res.send("Bistro boss is running");
})

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});