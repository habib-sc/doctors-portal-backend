const express = require('express')
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const nodemailer = require('nodemailer');
const sgTransport = require('nodemailer-sendgrid-transport');

// Middlewear 
app.use(cors());
app.use(express.json());

// Token verify middlewear 
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if(!authHeader){
    return res.status(401).send({message: 'Unauthorized Access!'});
  }

  const token = authHeader?.split(' ')[1];
  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(403).send({message: 'Forbidden Access!'});
    }
    req.decoded = decoded;
    next();
  });
};

// Email Option 
const emailSenderOptions = {
  auth: {
    api_key: process.env.SENDGRID_API_KEY
  }
}

const emailClient = nodemailer.createTransport(sgTransport(emailSenderOptions));

// Email Sending 
const sendAppointmentEmail = (booking) =>{
  const { patientName, email, treatment, date, slot } = booking;

  var emailData = {
    from: process.env.EMAIL_SENDER,
    to: email,
    subject: `Appointment for ${treatment} on ${date} at ${slot}`,
    text: `Your Appointment Confirmed for ${treatment} on ${date} at ${slot}`,
    html: `
      <div>
        <h3>Hello ${patientName}, </h3>

        <p>Your Appointment Confirmed for ${treatment}.<p>
        <p>Appointment Date: ${date}.<p>
        <p>Appointment Time: ${slot}.<p>

        <h3>Our Address</h3>
        <p>Bhulta, Rupganj, Narayanganj</p>
        <P>Bangladesh</>
        <a href="#">Unsubscribe</>
      </div>
    `
  };

  emailClient.sendMail(emailData, function(err, info){
    if (err ){
      console.log(err);
    }
    else {
      console.log('Message sent: ' + info);
    }
  });

}


// DB Info 
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@doctorsportal.iyeym.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run () {
    try{
        // Connecting db 
        await client.connect();
        const servicesCollection = client.db('DoctorsPortal').collection('Services');
        const bookingsCollection = client.db('DoctorsPortal').collection('Bookings');
        const usersCollection = client.db('DoctorsPortal').collection('Users');
        const doctorsCollection = client.db('DoctorsPortal').collection('Doctors');

        // Verify Admin 
        const verifyAdmin =  async(req, res, next) => {
          const requester = req.decoded.email;
          const requesterAccount = await usersCollection.findOne({email: requester});

          if (requesterAccount.role == 'admin') {
            next();
          }
          else{
            return res.status(403).send({message: 'Forbidden Access!'});
          }
        };

        // Service get
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query).project({name: 1});
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

        // Get booking by user
        app.get('/bookings', verifyToken, async (req, res) => {
          const email = req.query.email;
          const decodedEmail = req.decoded.email;

          if (email === decodedEmail) {
            const query = {email: email};
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
          }
          else{
            return res.status(403).send({message: 'Forbidden Access'});
          }
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
          sendAppointmentEmail(booking);
          res.send({success: true,  result});
        });

        // user get 
        app.get('/users', verifyToken, async (req, res) => {
          const users = await usersCollection.find().toArray();
          res.send(users);
        });

        // Upsert users and issue token 
      app.put('/user/:email', async(req, res) => {
          const email = req.params.email;
          const user = req.body;
          const filter = {email: email};
          const options = { upsert: true};
          const updateDocument = {
              $set: {...user},
          };
          const result = await usersCollection.updateOne(filter, updateDocument, options);
          const token = jwt.sign({email: email}, process.env.TOKEN_SECRET, {expiresIn: '1d' });
          res.send({result, token});
      });

      // making user admin 
      app.put('/user/admin/:email', verifyToken, verifyAdmin, async(req, res) => {
        const email = req.params.email;
        const filter = {email: email};
        const updateDocument = {
            $set: {role: 'admin'},
        };
        const result = await usersCollection.updateOne(filter, updateDocument);
        res.send(result);        
      });

      // check admin or not 
      app.get('/admin/:email', async (req, res) => {
        const email = req.params.email;
        const user = await usersCollection.findOne({email: email});
        const isAdmin = user.role === 'admin';
        res.send({admin: isAdmin});
      });

      // Doctor Add 
      app.post('/add-doctor', verifyToken, verifyAdmin, async(req, res) => {
        const doctor = req.body;
        const result = await doctorsCollection.insertOne(doctor);
        res.send(result);
      } );

      // Doctor Delete 
      app.delete('/doctor/:email', verifyToken, verifyAdmin, async(req, res) => {
        const email = req.params.email;
        const query = {email: email};
        const result = await doctorsCollection.deleteOne(query);
        res.send(result);
      } );

      // Doctor get 
      app.get('/doctors', verifyToken, verifyAdmin, async (req, res) => {
        const result = await doctorsCollection.find().toArray();
        res.send(result);
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
