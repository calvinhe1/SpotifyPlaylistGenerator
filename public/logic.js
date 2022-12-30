
let accessToken = null

const axios = require('axios')

let playlistIdGlobal = false
/* Plan:
1. Extract spotify playlist given a playlist link
2. Accept genre(s), artist(s), > date
3. Go through spotify playlist with these filters
4. Then create a NEW spotify playlist with the songs that pass these filters.

** have a section that keeps track of current playlists that are being scraped, not just one playlist at a time.

5. Somehow implement this check 24/7 and do it for MULTIPLE playlists.... (this probably involves a worker or some script that runs automatically
    or something, but should implement #6 first)
6. implement a DB and maintain state of the playlists you created (state management, and authorization of users)
7. Encrypt your client id and credentials.
8. Make a better UI (add genre category and can add current artists from playlist, can also e.g. have a selection filter)
Nah, but need to at least have a good landing page and working page. (check)

Next steps: Add a new page to manage playlists that are being filtered.
Need to add editing/adding logic/delete logic. If the target playlist is deleted or does not exist... should delete teh filtering playlist as well.

*/

function putTracksInPlaylist (trackURIs, playlistId) {
  // New playlist, put tracks inside.
  const numberOfCalls = Math.ceil(trackURIs.length / 100)
  let promises = []
  for (let i = 0; i < numberOfCalls; i++) {
    // limit of 100 tracks per API request
    const groupOfTracks = trackURIs.slice(0, 100)
    // console.log("Group: ", groupOfTracks)
    // NoW: put your tracks in playlist with all your URIs.
    // Note: only works for up to 100?
    let promise = axios({
      method: 'post',
      url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      data: {
        uris: groupOfTracks
      },
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      }
    }).then((response) => {
      console.log('Successful!')
      
    }).catch((err) => {
      throw new Error('Error putting tracks in playlist')
      // console.log("Error in putting tracks in playlist! ", err)
    })

    promises.push(promise)

    let noMoreTracks = false
    for (let j = 0; j < 100; j++) {
      if (trackURIs.length <= 0) {
        noMoreTracks = true
        break
      }

      trackURIs.shift()
    }

    if (noMoreTracks) {
      break
    }
  }
  
  return Promise.all(promises).then(function (resp) {
    playlistIdGlobal = playlistId
    return playlistIdGlobal
  }).catch((err) => {
    throw new Error('Error putting tracks in playlist')
  })

}

function createPlaylist (userId, trackURIs, playlistName) {
  // the refresh token scope is wrong?

  if (playlistName == '') { playlistName = 'New Playlist' }

  return axios({
    method: 'post',
    url: `https://api.spotify.com/v1/users/${userId}/playlists`,
    data: {
      name: playlistName,
      public: false
    },
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    }
  }).then((response) => {
    // Repsponse id is your playlist ID
    return putTracksInPlaylist(trackURIs, response.data.id)
  }).catch((err) => {
    throw new Error('Error creating playlist', err)
  })
}

function validateGenres (response, genresOfInterest) {
  for (const genre in genresOfInterest) {
    for (let j = 0; j < response.data.genres.length; j++) {
      if (response.data.genres[j].toUpperCase().includes(genre)) { return true }
    }
  }
  return false
}

function parsePlaylist (response, genres, artists, year, playlistName) {
  const artistRequest = {}

  const tracks = response.data.tracks
  const trackURIs = []

  let tempTracks = tracks.items
  const promises = []
  const promisesInner = []
  let numberOfTracks = 0
  const lengthArtists = Object.keys(artists).length
  const lengthGenres = Object.keys(genres).length

  if (lengthArtists == 0 && lengthGenres == 0 && year == '') {
    throw new Error('No artists, genres, or year')
  }

  if (lengthArtists == 0 && lengthGenres != 0) {
    throw new Error('Must enter an artist if genres entered')
  }

  /* If only genres are provided, can just consider ALL artists with those genres.
    if (lengthArtists == 0 && year == '') {
        alert("No artist or year entered!")
        //Entering a genre without an artist will not give any useful results.
    } */
  if (year) { year - 1 }
  const numberOfCalls = Math.floor(tracks.total / 100)

  const originalLink = tracks.href.split('?')[0]
  for (let i = 0; i < numberOfCalls; i++) {
    nextLink = originalLink + `?offset=${(i + 1) * 100}&limit=100`

    const promise =
        axios
          .get(
            nextLink, {
              headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
              }
            }).then((response) => {
            // console.log("RESPONSE: ", response)
            tempTracks = tempTracks.concat(response.data.items)
          }).catch((err) => {
            // console.log("Unable to extract spotify playlist", err)
            throw new Error('Error in GET playlist', err)
          })

    promises.push(promise)
    // Tracks.next only works for 2 slides.
  }

  // How about construct all your tracks before doing any processing.
  Promise.all(promises).then(function (resp) {
    // Execute code here.
    for (let i = 0; i < tempTracks.length; i++) {
      if (year != '' && new Date(tempTracks[i].added_at) < new Date(year)) {
        continue
      }
      // Go through artists and check if any fall in the map, if so, this track is good.
      const desiredArtistIds = []
      const artistsOfTrack = tempTracks[i].track.artists // this is all the artists in a track.

      if (lengthArtists != 0) {
        for (let j = 0; j < artistsOfTrack.length; j++) {
          if (artistsOfTrack[j].name.toUpperCase() in artists) {
            desiredArtistIds.push(artistsOfTrack[j].id)
          }
        }
      }

      if (lengthArtists != 0 && desiredArtistIds.length == 0) {
        continue
      }
      // For no artists entered
      else if (lengthArtists == 0) {
        for (let j = 0; j < artistsOfTrack.length; j++) {
          desiredArtistIds.push(artistsOfTrack[j].id)
        }
      }

      // there are desired artists and there are artists.

      // Call API to desired artists, and check what genre the desiredArtist(s) belongs to.

      // if b.e.

      for (let j = 0; j < desiredArtistIds.length; j++) {
        const promise = axios
          .get(
                        `https://api.spotify.com/v1/artists/${desiredArtistIds[j]}`, {
                          headers: {
                            Accept: 'application/json',
                            Authorization: 'Bearer ' + accessToken,
                            'Content-Type': 'application/json'
                          }
                        }).then((response) => {
            // Call a funciton that validates genres, if so mark this track as a canditate.

            if (lengthGenres == 0 || validateGenres(response, genres)) {
              if (!(trackURIs.includes(tempTracks[i].track.uri))) {
                numberOfTracks = trackURIs.push(tempTracks[i].track.uri)
                artistRequest[desiredArtistIds[j]] = true
              }
            }
          }).catch((err) => {
            throw new Error('Error getting artist info', err)
            // console.log(`Error in getting artist ID: ${desiredArtistIds[j]}`, err)
          })
        promisesInner.push(promise)
      }
    }
    // If no genre and no artist and just a year condition, then add, otherwise leave it to above.
    /*
        if (lengthArtists == 0 && lengthGenres == 0) {
            //Promises
            numberOfTracks = trackURIs.push(tempTracks[i].track.uri)
        } */

    // Resolve all axios promises here.
    Promise.all(promisesInner).then(function (resp) {
      // Get the user_id.
      if (numberOfTracks != 0) {
        return axios
          .get(
            'https://api.spotify.com/v1/me', {
              headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
              }
            }).then((response) => {
            // Call a funciton that validates genres, if so mark this track as a canditate.
            // console.log("Response: ", response)
            return createPlaylist(response.data.id, trackURIs, playlistName)
          }).catch((err) => {
            throw new Error('Error in getting spotify user ID')
          })
      }
    })
  })
    .catch(function (err) {
      throw new Error('Error in resolving promises in parsing playlist')
    })
}

function getPlaylistId(input = '', artistsOfInterest, genresOfInterest, yearAfterInterest, playlistName) {
  const playlistIDLength = 22
  const URL = input.split('/')
  let playlist = ''
  const spotifyLink = 'open.spotify.com'
  let isSpotifyLink = false

  // extract genres and artists, date added.
  for (let i = 0; i < URL.length; i++) {
    if (URL[i] == spotifyLink) { isSpotifyLink = true } else if (URL[i].length >= playlistIDLength) {
      // browser link
      if (URL[i].length == playlistIDLength) {
        playlist = URL[i]
      } else {
        playlist = URL[i].split('?')
        playlist = playlist[0]
      }
    }
  }

  if (artistsOfInterest == '') { artistsOfInterest = [] } else { artistsOfInterest = artistsOfInterest.split(',') }

  if (genresOfInterest == '') { genresOfInterest = [] } else { genresOfInterest = genresOfInterest.split(',') }

  if (playlistName == '')  {
    playlistName = 'New Playlist'
  }

  return [playlist, isSpotifyLink, artistsOfInterest, genresOfInterest, yearAfterInterest, playlistName]

}

function enterPlaylist (access_token, artistsOfInterest, genresOfInterest, yearAfterInterest, playlistName = 'New Playlist', playlist, isSpotifyLink) {
  const artistsMap = {}
  const genresMap = {}

  accessToken = access_token

  for (let i = 0; i < artistsOfInterest.length; i++) {
    artistsMap[artistsOfInterest[i].toUpperCase()] = 1
  }

  for (let i = 0; i < genresOfInterest.length; i++) {
    genresMap[genresOfInterest[i].toUpperCase()] = 1
  }

 
  if (isSpotifyLink && playlist != '') {
    // Create a new playlist.
    // Make a GET request to get the playlist information.
     return axios
      .get(
            `https://api.spotify.com/v1/playlists/${playlist}`, {
              headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
              }
            }).then((response) => {
        parsePlaylist(response, genresMap, artistsMap, yearAfterInterest, playlistName)
      }).catch((err) => {
        throw new Error('Unable to extract spotify playlist', err)
      })
  }
}

function addEventListeners (element) {
  if (element) {
    element.addEventListener('keypress', function (event) {
      if (event.key == 'Enter') {
        enterPlaylist()
      }
    })
  }
}

module.exports = { enterPlaylist, getPlaylistId }
