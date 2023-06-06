require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_PAYMENT_KEY); 
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
const JWT_SECRETE_TOKEN = process.env.JWT_SECRETE_TOKEN || "";



// Middle were //
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  console.log("authorization" ,authorization);
  if (!authorization) {
    return res.status(401).send( {error: true, message: "unauthorized access"});
  }
  else{
    const token = authorization.split(' ')[1];
    jwt.verify(token, JWT_SECRETE_TOKEN, (error, decoded) => {
      if (error) {
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
    const paymentCollection = client.db("bistroBossDb").collection("payment");





    // Secure Admin  //
    const verifyAdmin = async (req,res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const result = await userCollection.findOne(query);
      if (result?.role !== 'admin') {
        return res.status(403).send({error: true, message: 'forbiidden user'})
      }
      next();
    }


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, JWT_SECRETE_TOKEN, {expiresIn: '1hr'});
      console.log(token);
      res.send({token})
    })

       // Stripe Payment Method //
       app.post("/create-payment-intent", verifyJWT,async (req, res) => {
        const { price } = req.body;
        console.log(price);
        const amount = price * 100;
        const finalAmount = parseInt(amount);
        console.log(amount, finalAmount);
        
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
          amount: finalAmount,
          currency: "usd",
          payment_method_types: ['card'], 
        });
      
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      });

      app.post('/payment', verifyJWT,async(req, res) => {
        const payment = req.body;

        const query = {_id: {$in: payment.cartsItems.map(id => new ObjectId(id))}}

        const deleteResult = await cartsCollection.deleteMany(query);


        const result = await paymentCollection.insertOne(payment);
        res.send({result, deleteResult});
      })


      // Admin page data management functions //
      app.get('/user-stats', async (req, res) => {
        const user = await userCollection.estimatedDocumentCount();
        const products = await menuCollection.estimatedDocumentCount();
        const order = await paymentCollection.estimatedDocumentCount();
        const revenue = await paymentCollection.find().toArray();
        const totalRevenue = revenue.reduce((preValue, currentValue) => preValue + currentValue.price,0)
        res.send({
          user,
          products,
          order,
          totalRevenue,
        })
      })


    // User collection data management //
    app.get('/users', verifyJWT, verifyAdmin,async (req, res) => {

      const email = req.decoded.email;
      if (!email) {
        return res.status(403).send({error: true, message: 'forbidden email'})
      }
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
      res.send({result});
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
      const decodedEmail = req.decoded.email;
      if (!decodedEmail) {
        return res.status(403).send({error: true, message: "forbidden access"})
      }
      const query = { email: email }
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });


    // Add a new item or product to main collection //
    app.post('/items',verifyJWT, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result)
    })

    // ADD Product to cart collection add to cart //
    app.post('/carts', async (req, res) => {
      const data = req.body;
      const result = await cartsCollection.insertOne(data);
      res.send(result);
    })

    app.delete('/item/:id', verifyJWT, verifyAdmin,async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await menuCollection.deleteOne(query);
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