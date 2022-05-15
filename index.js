const express = require('express')
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();
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
        const bookingsCollection = client.db('DoctorsPortal').collection('Bookings');

        // Service get
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const resutl = await cursor.toArray();
            res.send(resutl);
        });


        app.get('/available-services', async (req, res) => {
          const date = req.query.date;

          // getting all services 
          const services = await servicesCollection.find().toArray();

          // getting booking date wise
          const query = {date: date};
          const bookings = await bookingsCollection.find(query).toArray();

          // checking all services and find booking for that service 
          services.forEach(service => {
            // finding bookings for service 
            const serviceBookings = bookings.filter(b => b.treatment === service.name);
            // getting booked slots 
            const bookedSlots = serviceBookings.map(sb => sb.slot);
            // getting available slots  
            const available = service.slots.filter(s=> !bookedSlots.includes(s));
            // set available slots to slots 
            service.slots = available;
          });

          res.send(services);
        });

        // Get booking 
        app.get('/bookings', async (req, res) => {
          const email = req.query.email;
          const query = {email: email};
          const bookings = await bookingsCollection.find(query).toArray();
          res.send(bookings);
        });


        // Booking post 
        app.post('/booking', async (req, res) => {
          const booking = req.body;
          const query = {treatment: booking.treatment, date: booking.date, email: booking.email};
          const exists = await bookingsCollection.findOne(query);

          if (exists) {
            return res.send({success: false, booking: exists})
          }

          const result = await bookingsCollection.insertOne(booking);
          res.send({success: true,  result});
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
