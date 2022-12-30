require('dotenv').config();

var express = require('express'),
  session = require('express-session'),
  passport = require('passport'),
  SpotifyStrategy = require('passport-spotify').Strategy,
  consolidate = require('consolidate');

const ejs = require("ejs")
const uuid = require("uuid")
var bodyParser = require('body-parser');
const mongoose = require("mongoose")
const findOrCreate = require('mongoose-findorcreate');
let accessTokenGlobal;
const passportLocalMongoose = require("passport-local-mongoose");

const { getPlaylistId} = require("./public/logic")
const { enterPlaylist } = require('./public/logic')

var port = 8888;
var authCallbackPath = '/auth/spotify/callback';

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session. Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing. However, since this example does not
//   have a database of user records, the complete spotify profile is serialized
//   and deserialized.
var app = express();

app.use(express.static(__dirname + '/public'))
//app.engine('ejs', consolidate.nunjucks);

// configure Express
//app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}))

app.use(
  session({secret: 'keyboard cat', resave: true, saveUninitialized: true})
);
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());

mongoose.set('strictQuery', true);
mongoose.connect("mongodb://localhost:27017/playlistDB", {useNewUrlParser: true});


const userSchema = new mongoose.Schema ({
  spotifyId: String,
  email: String,
  password: String,
  googleId: String,
  secret: String
});

const playlistSchema = new mongoose.Schema ({
  name: String,
  playlistId: String,
  artists: [String],
  genres: [String],
  year: String,
  uuid: String
})

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema)
const Playlist = new mongoose.model("Playlist", playlistSchema)

passport.use(User.createStrategy())

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// Use the SpotifyStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, expires_in
//   and spotify profile), and invoke a callback with a user object.
passport.use(
  new SpotifyStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: 'http://localhost:' + port + authCallbackPath,
    },
    function (accessToken, refreshToken, expires_in, profile, done) {
      // asynchronous verification, for effect...
      //console.log("Profile: ", profile, accessToken, refreshToken)
    accessTokenGlobal = accessToken

    User.findOrCreate({ spotifyId: profile.id }, function (err, user) {
      return done(err, user);
    });
    /*
      process.nextTick(function () {
        // To keep the example simple, the user's spotify profile is returned to
        // represent the logged-in user. In a typical application, you would want
        // to associate the spotify account with a user record in your database,
        // and return that user instead.
        return done(null, profile);
      });*/
    }
  )
);

app.get('/', function (req, res) {
  //res.render('index.ejs', {user: req.user});

  if (req.isAuthenticated()) {
    res.render("create.ejs")
  }
  else {
    res.render("index.ejs")
  }
});

app.get('/logout', function (req, res) {
  req.logout(function(err) {
    if (err) {
      console.log("error logging out: ", err)
    }
  });
  res.redirect('/')
});

app.get('/create', ensureAuthenticated, function (req, res) {
  res.render('create.ejs')
});

app.post('/create', async function(req,res) {

  //return playlist ID.

  //extract playlist id.
  let values = []
  values = getPlaylistId(req.body.playlistEnter, req.body.artistsEnter, req.body.genresEnter, req.body.yearEnter, req.body.playlistName)
  //enter playlist is not complete yet, the idea is we want it to be completed.
  let promise = enterPlaylist(accessTokenGlobal, values[2], values[3], req.body.yearEnter, req.body.playlistName, values[0], values[1])

  promise.then((response) => {  
    console.log("RESPONSE: ", response)
    //Save it in playlist schema.
    const playlist = new Playlist({
        name: values[5],
        playlistId: values[0],
        artists: req.body.artistsEnter,
        genres: req.body.genresEnter,
        year: req.body.yearEnter,
        uuid: uuid.v4()
    });

    playlist.save().then((result) => {
      res.redirect("/create")
      //res.send(result)
    }).catch((error) => {
      res.send("error saving playlist to playlist schema")
    })

  }).catch((err) => {
    res.status(400).send('Bad Request');
  })
  
  //return the playlist id, however, make sure to nothing breaks e.g. deleting something before playing list is finished (race conditions)
  //await User.deleteMany({spotifyId: '226b44enp4g7t4mc22evqyskq'});
  //if successful store this playlist in the DB.

})

app.delete('/deleteAllPlaylists', function(req, res) {

  Playlist.deleteMany({}).then(function() {
    console.log("Delete all playlists")
    res.sendStatus(204)
  }).catch(function(error) {
    console.log(error)
  })

  
})

//View all your playlists page  
app.get('/playlists', function(req,res) {

  if (!req.isAuthenticated()) {
    res.render('index')
  }

  Playlist.find({}, function (err, playlists) {
    if (err) {
      console.log(err);
    } else {
      if (playlists) {
       // console.log("playlist: ", playlists)
        res.render("playlists", {listOfPlaylists: playlists})
      }
    }

  })

  //res.render('/playlists.ejs')
})

//individual playlists page
app.get('/:playlistUuid', function(req,res) {
    //Basically open the create page with filled out fields.
    //what is the id?
   const playlistUuid = req.path.slice(1)

   Playlist.find({uuid: playlistUuid}, function (err, playlist) {
    if (err) {
      console.log(err);
    } else {
      if (playlist.length != 0) {
        //Wrong, you actually want a entirely UNIQUE ID associated with this playlist entry. as a separate field.
       // console.log("playlist: ", playlists)
       console.log("playlist: ", playlist)
        res.render("individualPlaylist", {playlistEdit: playlist[0]})
      }
    }

  })
})

//delete individual playlist from the playlist page above
app.post('/deletePlaylist/:playlistId', function(req,res) {
  console.log("using this as the DELETE route")


})

//edit an individual playlist page
app.post('/:playlistUuid', function(req,res) {
  console.log("Using this as the PUT route.")
  console.log("req: ", req)

  //get the parameters as well, rerun the function to get track URIs, then compare it with the existing track URIs, and add in the track URIs
  //that are new.
  //the new settings might override tracks.

  //so look at existing tracks, if they match NEW tracks keep, if they do not REMOVE, and if they are new ADD.

  //ADD spotify track URIs route, Remove spotify track URIs route.


})

/*
app.get('/login', function (req, res) {
  res.render('login.ejs', {user: req.user});
});*/

// GET /auth/spotify
//   Use passport.authenticate() as route middleware to authenticate the
//   request. The first step in spotify authentication will involve redirecting
//   the user to spotify.com. After authorization, spotify will redirect the user
//   back to this application at /auth/spotify/callback
app.get(
  '/auth/spotify',
  passport.authenticate('spotify', {
    scope: ['user-read-email', 'user-read-private', 'user-library-read', 'playlist-read-private', 'playlist-modify-private', 'playlist-modify-public'],
    showDialog: true,
  })
);

// GET /auth/spotify/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request. If authentication fails, the user will be redirected back to the
//   login page. Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get(
  authCallbackPath,
  passport.authenticate('spotify', {failureRedirect: '/'}),
  function (req, res) {
    res.redirect('/create');
  }
);

app.listen(port, function () {
  console.log('App is listening on port ' + port);
});

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed. Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}
