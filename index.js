const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;

// Middle were //
app.use(cors());
app.use(express.json());

app.get('/', (req, res)=> {
    res.send("Bistro boss is running");
})

app.listen(port, ()=> {
    console.log(`http://localhost:${port}`);
});