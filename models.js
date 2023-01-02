require('dotenv').config()

const express = require('express')
const session = require('express-session')
const passport = require('passport')

const connectDB = process.env.MONGODB_URI || 'mongodb://localhost:27017/playlistDB'

const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const findOrCreate = require('mongoose-findorcreate')
const passportLocalMongoose = require('passport-local-mongoose')

const app = express()

app.use(express.static(__dirname + '/public'))
// app.engine('ejs', consolidate.nunjucks);

// configure Express
// app.set('views', __dirname + '/views');
app.set('view engine', 'ejs')

app.use(bodyParser.urlencoded({
  extended: true
}))

app.use(
  session({ secret: 'keyboard cat', resave: true, saveUninitialized: true })
)
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize())
app.use(passport.session())

mongoose.set('strictQuery', true)
mongoose.connect(connectDB, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true })
.then(()=> console.log("Database connected"))
.catch(err => console.log("err: ", err))

const playlistSchema = new mongoose.Schema({
  name: String,
  playlistIdRef: String,
  playlistId: String,
  artists: String,
  genres: String,
  year: String,
  tracks: [String],
  spotifyId: String
})

const userSchema = new mongoose.Schema({
    spotifyId: String,
    accessToken: String,
    refreshToken: String
})
  

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

const User = new mongoose.model('User', userSchema)
const Playlist = new mongoose.model('Playlist', playlistSchema)

passport.use(User.createStrategy())

passport.serializeUser(function (user, done) {
  done(null, user.id)
})

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user)
  })
})


module.exports = { User, Playlist, app } 