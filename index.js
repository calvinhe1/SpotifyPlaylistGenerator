require('dotenv').config()

const passport = require('passport')
const SpotifyStrategy = require('passport-spotify').Strategy

let accessTokenGlobal
let spotifyProfileId

const { getPlaylistId } = require('./public/logic')
const { enterPlaylist } = require('./public/logic')
const { deletePlaylist } = require('./public/logic')

const { User, Playlist, app } = require('./models')

const port = process.env.PORT || 8888

//Change redirect URI depending on the enviroment
const env = process.env.ENV || "development"
let redirectURI
if (env == 'production') {
  redirectURI = 'https://whispering-falls-70349.herokuapp.com'
} else {
  redirectURI = 'http://localhost:' + port
}

const authCallbackPath = '/auth/spotify/callback'

passport.use(
  new SpotifyStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: redirectURI + authCallbackPath
    },
    function (accessToken, refreshToken, expires_in, profile, done) {
      accessTokenGlobal = accessToken
      spotifyProfileId = profile.id
        User.findOrCreate({ spotifyId: profile.id },  function (err, user) {
          User.updateOne({ spotifyId: profile.id }, { accessToken: accessToken, refreshToken: refreshToken }).then({
          })
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
      tracks: response[0],
      spotifyId: spotifyProfileId
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
  Playlist.find({ spotifyId: spotifyProfileId }, function (err, playlists) {
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
    scope:  ['user-read-email', 'user-read-private', 'playlist-modify-private', 'playlist-modify-public', 'playlist-read-private', 'playlist-read-collaborative'],
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
