const { User, Playlist } = require('./models')

const { getPlaylistId } = require('./public/logic')
const { enterPlaylist } = require('./public/logic')
const axios = require('axios')

let map = {}

function refreshAccessToken (user) {
// Refresh access token first thing for all users, since this job will run in a regular interval e.g. daily
  const res = axios({
    method: 'post',
    url: 'https://accounts.spotify.com/api/token',
    data: {
      grant_type: 'refresh_token',
      refresh_token: user.refreshToken
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET)
    }
  }).then((response) => {
    // Save this access token.
    return User.updateOne({ spotifyId: user.spotifyId }, { accessToken: response.data.access_token }).then((res) => {
      map[user.spotifyId] = response.data.access_token
    })
      .catch((err) => {
        console.log('Error refreshing access token in database', err)
      })
  }).catch((err) => {
    console.log('Error refreshing access token', err)
  })

  return res
}

/****This job will be ran by the Heroku scheduler, and will is the update all of the playlists for every registered user with their current filtered playlists daily. ***/
function job (playlist, accessToken) {
  // Refresh access token for every user...... and put it in a map.... so you can access it's access token, but still need to do Playlist.find({}) and User.find({}) then loop through playlists.
  const values = getPlaylistId(playlist.playlistIdRef, playlist.artists, playlist.genres, playlist.year, playlist.name, true)
  const promise = enterPlaylist(accessToken, values[2], values[3], playlist.year, values[5], playlist.playlistIdRef, true, playlist.tracks, playlist.playlistId, playlist.name)
  return promise.then((response) => {
    console.log('Values: ', values)
    return Playlist.updateOne({ playlistId: playlist.playlistId }, { tracks: response, name: values[5], artists: playlist.artists, genres: playlist.genres, year: playlist.year }).then((result) => {
    }).catch((err) => {
      console.log('Failed to save playlist into database', err)
    })
  }).catch((err) => {
    console.log(`Error updating playlist ${playlist.playlistId} for user ${playlist.spotifyId}`, err)
    // Add error case where you try to edit a playlist that no longer exists (due to manual deletion)
    if (err.messsage == 'Playlist no longer exists') {
      return Playlist.deleteOne({ playlistId: playlist.playlistId })
      .catch(err => {
        console.log('Error in deleting playlist in database', err)
      })
    }
  })
}

User.find({}, function (err, users) {
  if (err) {
    console.log('Error finding users in database', err)
  } else {
    if (users) {
      const promises = []
      for (let i = 0; i < users.length; i++) {
        const promise = refreshAccessToken(users[i])
        promises.push(promise)
      }

      Promise.all(promises).then((response) => {
        // Run through your playlists with the map.
        Playlist.find({}).then((playlists) => {  
          let promisesInner = []
          for (let i = 0; i < playlists.length; i++) {
            let p = job(playlists[i], map[playlists[i].spotifyId])
            promisesInner.push(p)
          }
          Promise.all(promisesInner).then((response) => {
            console.log('Resolved all playlist promises')
            process.exit()
          })
        })
          .catch((err) => {
            console.log('error finding playlists in database', err)
          })
      }).catch((err) => {
        console.log('error getting access tokens for users', err)
      })
    }
  }
})
