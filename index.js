require('dotenv').config()

const express = require('express')
const session = require('express-session')
const passport = require('passport')
const SpotifyStrategy = require('passport-spotify').Strategy
const connectDB = 'mongodb://localhost:27017/playlistDB'

const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const findOrCreate = require('mongoose-findorcreate')
let accessTokenGlobal
const passportLocalMongoose = require('passport-local-mongoose')

const { getPlaylistId } = require('./public/logic')
const { enterPlaylist } = require('./public/logic')
const { deletePlaylist } = require('./public/logic')

const port = 8888
const authCallbackPath = '/auth/spotify/callback'

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
mongoose.connect(connectDB, { useNewUrlParser: true })

const userSchema = new mongoose.Schema({
  spotifyId: String,
  email: String,
  password: String,
  googleId: String,
  secret: String
})

const playlistSchema = new mongoose.Schema({
  name: String,
  playlistIdRef: String,
  playlistId: String,
  artists: String,
  genres: String,
  year: String,
  uuid: String,
  tracks: [String]
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

passport.use(
  new SpotifyStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: 'http://localhost:' + port + authCallbackPath
    },
    function (accessToken, refreshToken, expires_in, profile, done) {
      accessTokenGlobal = accessToken
      User.findOrCreate({ spotifyId: profile.id }, function (err, user) {
        return done(err, user)
      })
    }
  )
)

app.get('/', function (req, res) {
  if (req.isAuthenticated()) {
    const data = {}
    data.playlistEnter = ''
    data.genresEnter = ''
    data.artistsEnter = ''
    data.yearEnter = ''
    data.playlistName = ''

    res.render('create', { data })
  } else {
    res.render('index.ejs')
  }
})

app.get('/logout', function (req, res) {
  req.logout(function (err) {
    if (err) {
      console.log('Error logging out: ', err)
    }
  })
  res.redirect('/')
})

app.get('/create', ensureAuthenticated, function (req, res) {
  if (req.isAuthenticated()) {
    const data = {}
    data.playlistEnter = ''
    data.genresEnter = ''
    data.artistsEnter = ''
    data.yearEnter = ''
    data.playlistName = ''

    res.render('create', { data })
  } else {
    res.render('index.ejs')
  }
})

app.post('/create', async function (req, res) {
  let values = []
  values = getPlaylistId(req.body.playlistEnter, req.body.artistsEnter, req.body.genresEnter, req.body.yearEnter, req.body.playlistName)

  const promise = enterPlaylist(accessTokenGlobal, values[2], values[3], req.body.yearEnter, values[5], values[0], values[1])

  promise.then(async (response) => {
    const playlist = new Playlist({
      name: values[5],
      playlistIdRef: values[0],
      playlistId: response[1],
      artists: req.body.artistsEnter,
      genres: req.body.genresEnter,
      year: req.body.yearEnter,
      tracks: response[0]
    })

    playlist.save().then((result) => {
      res.render('create', { successMessage: 'Successful!', data: req.body })
    }).catch((err) => {
      console.log('Error failing to save playlist into database', err)
      res.render('create', { errorMessage: 'Failed to save playlist into database' })
    })
  }).catch((err) => {
    console.log('Error in creating new playlist', err)
    res.render('create', { errorMessage: err.message, data: req.body })
  })
})

app.delete('/deleteAllPlaylists', function (req, res) {
  Playlist.deleteMany({}).then(function () {
    console.log('Deleted all playlists')
    res.sendStatus(204)
  }).catch(function (error) {
    console.log('Error deleting all playlists', error)
  })
})

// View all your playlists page
app.get('/playlists', function (req, res) {
  if (!req.isAuthenticated()) {
    res.render('index')
  }

  Playlist.find({}, function (err, playlists) {
    if (err) {
      console.log('Error finding playlists', err)
    } else {
      if (playlists) {
        res.render('playlists', { listOfPlaylists: playlists })
      }
    }
  })
})

// individual playlists page
app.get('/:playlistId', function (req, res) {
  if (!req.isAuthenticated()) {
    res.render('index')
  }
  const id = req.path.slice(1)

  Playlist.find({ playlistId: id }, function (err, playlist) {
    if (err) {
      console.log('Error finding playlist', err)
    } else {
      if (playlist.length != 0) {
        res.render('individualPlaylist', { playlistEdit: playlist[0] })
      }
    }
  })
})

// delete individual playlist from the playlist page above
app.post('/deletePlaylist/:playlistId', function (req, res) {
  console.log('using this as the DELETE route for playlists')

  const promise = deletePlaylist(accessTokenGlobal, req.params.playlistId)

  promise.then((response) => {
    Playlist.deleteOne({ playlistId: req.params.playlistId }).then((result) => {
      res.redirect('../playlists')
    }).catch(err => {
      console.log('Error in deleting playlist in database', err)
    })
  }).catch((err) => {
    //Add error case where you try to delete a playlist that no longer exists (due to manual deletion)
    if (err.messsage == "Playlist no longer exists") {
        Playlist.deleteOne({ playlistId: req.params.playlistId }).then((result) => {
          res.redirect('../playlists')
        }).catch(err => {
          console.log('Error in deleting playlist in database', err)
        })
    }
  })
})

// edit an individual playlist page
app.post('/:playlistId', function (req, res) {
  console.log('Using this as the PUT route for editing playlists.')

  Playlist.find({ playlistId: req.params.playlistId }, function (err, playlist) {
    if (err) { console.log('Error finding playlist id in database: ', err) } else {
      let values = []
      values = getPlaylistId(playlist[0].playlistIdRef, req.body.artistsEnter, req.body.genresEnter, req.body.yearEnter, req.body.playlistName, true)

      const promise = enterPlaylist(accessTokenGlobal, values[2], values[3], req.body.yearEnter, values[5], playlist[0].playlistIdRef, true, playlist[0].tracks, playlist[0].playlistId, playlist[0].name)

      const playlistData = {}
      playlistData.genres = req.body.genresEnter
      playlistData.artists = req.body.artistsEnter
      playlistData.playlistId = req.params.playlistId
      playlistData.year = req.body.yearEnter
      playlistData.name = req.body.playlistName

      promise.then((response) => {
        Playlist.updateOne({ playlistId: req.params.playlistId }, { tracks: response, name: values[5], artists: req.body.artistsEnter, genres: req.body.genresEnter, year: req.body.yearEnter }).then((result) => {
          res.render('individualPlaylist', { playlistEdit: playlistData, successMessage: 'Successful!' })
        }).catch((err) => {
          console.log('Failed to save playlist into database', err)
          res.render('individualPlaylist', { playlistEdit: playlistData, errorMessage: 'Failed to save playlist into database' })
        })
      }).catch((err) => {
        //Add error case where you try to edit a playlist that no longer exists (due to manual deletion)
        if (err.messsage == "Playlist no longer exists") {
          Playlist.deleteOne({ playlistId: req.params.playlistId }).then((result) => {
            res.redirect('playlists')
          }).catch(err => {
            console.log('Error in deleting playlist in database', err)
          })
      }
        res.render('individualPlaylist', { playlistEdit: playlistData, errorMessage: err.message })
      })
    }
  })
})

app.get(
  '/auth/spotify',
  passport.authenticate('spotify', {
    scope: ['user-read-email', 'user-read-private', 'playlist-modify-private', 'playlist-modify-public'],
    showDialog: true
  })
)

app.get(
  authCallbackPath,
  passport.authenticate('spotify', { failureRedirect: '/' }),
  function (req, res) {
    res.redirect('/create')
  }
)

app.listen(port, function () {
  console.log('App is listening on port ' + port)
})

function ensureAuthenticated (req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }
  res.redirect('/')
}
