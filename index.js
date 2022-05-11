const express = require('express')
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Middlewear 
app.use(cors());
app.use(express.json());


// DB Info 
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@doctorsportal.iyeym.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run () {
    try{
        // Connecting db 
        await client.connect();
        const servicesCollection = client.db('DoctorsPortal').collection('Services');

        // Service get
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const resutl = await cursor.toArray();
            res.send(resutl);
        });

 
    }
    finally{

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Doctors Portal');
})

app.listen(port, () => {
  console.log(`Doctors Portal Running On Port ${port}`);
})
