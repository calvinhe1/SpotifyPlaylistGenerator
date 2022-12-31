
let accessToken = null

const axios = require('axios')

const playlistIdGlobal = false
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

function updateNameOfPlaylist(playlistNameNew, playlistId) {
  const promise = axios({
    method: 'put',
    url: `https://api.spotify.com/v1/playlists/${playlistId}`,
    data: {
      name: playlistNameNew
    },
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    }
  })

  promise.then((response) => {
    console.log("Changed name?: ", response)
    return;
  }).catch((err) => {
    console.log("error in changing playlist name: ", err)
  })

}

function removeTracksInPlaylist(trackURIs, playlistId) {
  const numberOfCalls = Math.ceil(trackURIs.length / 100)

  console.log("REMOVE: ", trackURIs)
  let formattedData = []

  for (let i=0; i<trackURIs.length; i++) {

    let obj = {}
    obj["uri"] = trackURIs[i]
    formattedData.push(obj)
  }

  const promises = []
  for (let i = 0; i < numberOfCalls; i++) {
    // limit of 100 tracks per API request
    const groupOfTracks = formattedData.slice(0, 100)
    // console.log("Group: ", groupOfTracks)
    // NoW: put your tracks in playlist with all your URIs.
    // Note: only works for up to 100?
    const promise = axios({
      method: 'delete',
      url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      data: {
        tracks: formattedData
      },
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      }
    }).then((response) => {
      console.log('Successful!')
    }).catch((err) => {
      //console.log("err:", err)
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
    //console.log('Copy of track URIs: ', copyOfTrackURIs)
    return;
  }).catch((err) => {
    throw new Error('Error putting tracks in playlist')
  })


}

function putTracksInPlaylist (trackURIs, playlistId) {

  console.log("PUT TRACKS: ", trackURIs)
  // New playlist, put tracks inside.
  const numberOfCalls = Math.ceil(trackURIs.length / 100)

  const copyOfTrackURIs = [...trackURIs]

  for (let i = 0; i < trackURIs.length; i++) {
    copyOfTrackURIs
  }

  const promises = []

  for (let i = 0; i < numberOfCalls; i++) {
    // limit of 100 tracks per API request
    const groupOfTracks = trackURIs.slice(0, 100)
    console.log("playlist id: group: ", playlistId, groupOfTracks)

    // console.log("Group: ", groupOfTracks)
    // NoW: put your tracks in playlist with all your URIs.
    // Note: only works for up to 100?
    const promise = axios({
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
    //console.log('Copy of track URIs: ', copyOfTrackURIs)
    //This is the new playlist id.
    return [copyOfTrackURIs, playlistId]
  }).catch((err) => {
    throw new Error('Error putting tracks in playlist')
  })
}

function createPlaylist (userId, trackURIs, playlistName) {
  // Depending on if a playlist id is provided, do not create a brand new playlist.

  // instead, EDIT and DELETE.

  // the refresh token scope is wrong?

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
  console.log("response!!!!: ", response)
  for (const genre in genresOfInterest) {
    for (let j = 0; j < response.genres.length; j++) {
      if (response.genres[j].toUpperCase().includes(genre)) { return true }
    }
  }
  return false
}

function compareTracks(oldTracks=[], newTracks=[]) {
  //Get final list of NEW addition tracks and traacks that NEED to be removed.
  //New list of tracks subtract tracks already in -> Tracks that need to be added
  //Old tracks that do not belong in NEW tracks -> Tracks that need to be removed.
  console.log("Tracks: ", oldTracks, newTracks)
  let newMap = {}

  for (let i=0; i<newTracks.length; i++) {
    newMap[newTracks[i]] = 1
  }

  console.log("new map: ", newMap)

  let removeTracks = []
  let existingTracks = {}
  let addTracks = []

  for (let i=0; i<oldTracks.length; i++) {
    if (!(oldTracks[i] in newMap)) {
      removeTracks.push(oldTracks[i])
    } else {
      existingTracks[oldTracks[i]] = 1
    }
  }
  console.log("Existing tracks: ", existingTracks)

  for (let i=0; i<newTracks.length; i++) {
    if (!(newTracks[i] in existingTracks)) {
      addTracks.push(newTracks[i])
    }
  }

  return [addTracks, removeTracks, newTracks]

}

function parsePlaylist (response, genres, artists, year, playlistName, oldTracks = [], existingPlaylistId='', oldPlaylistName='') {
  // return 4

  console.log("params in parse: ", genres, artists, year, playlistName, oldTracks, existingPlaylistId, oldPlaylistName)
  const tracks = response.data.tracks
  const trackURIs = []

  let tempTracks = tracks.items
  const promises = []
  const promisesInner = []
  let numberOfTracks = 0
  const lengthArtists = Object.keys(artists).length
  const lengthGenres = Object.keys(genres).length

  if (lengthArtists == 0 && lengthGenres == 0 && year == '') {
    throw new Error('No artists, genres, or year entered')
  }

  if (lengthArtists == 0 && lengthGenres != 0) {
    throw new Error('Please enter an artist if genres are entered')
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
  return Promise.all(promises).then(function (resp) {
    // Here, trackURIs is finalized.
    // console.log("Track URIS: ", tempTracks)
    // Execute code here.

    let desiredArtistIds = []

    for (let i = 0; i < tempTracks.length; i++) {
      if (year != '' && new Date(tempTracks[i].added_at) < new Date(year)) {
        continue
      }
      // Go through artists and check if any fall in the map, if so, this track is good.
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

      // too much repeated calls for a specific artists probably.
      /*
      for (let j = 0; j < desiredArtistIds.length; j++) {

        //Breaking rate limiting, because too much repetitive calls e.g. breaks at 2020.
        //Make potentially number of artists in 1 track * number of tracks, and if it is the same ARTIST (this case), it'll
        //be repetive
        //instead want to make ONE single call for ALL of the DESIRED artists together.
        //Then loop through the OBJECT of ARTISTS, and if AN ARTIST passes GENRE CHECK, ADD TRACKS WITH THIS ARTIST IN IT.
        //So make A BRAND NEW LIST OF SUCCESSFUL CANDITATE ARTISTS.............
        //THEN REGO OVER all the tracks and IF IT HAS THE ABOVE ARTIST, THEN passes.
        //Slower but 1 API call only.

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
              }
            }
          }).catch((err) => {
            throw new Error('Error getting artist info', err)
            // console.log(`Error in getting artist ID: ${desiredArtistIds[j]}`, err)
          })
        promisesInner.push(promise)
      } */
    }
    desiredArtistIds = [...new Set(desiredArtistIds)]

    
    const numberOfCalls = Math.ceil(desiredArtistIds.length / 50)
    const promisesArtistsCall = []
    for (let i = 0; i < numberOfCalls; i++) {
      let currentArtists = desiredArtistIds.slice(i*50, (i+1)*50)
      let stringArtists = currentArtists.toString()
      let finalURL = `https://api.spotify.com/v1/artists` + '?ids=' + stringArtists
      //Why is htis not working???????
      const promise = axios({
        method: 'get',
        url: `https://api.spotify.com/v1/artists` + '?ids=' + stringArtists,
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        }
      }).then((res) => {
        return res
      })
      .catch((err) => {
       //console.log("err arts: ",  err.response)
      })

      promisesArtistsCall.push(promise)
    }
    console.log("Desired artists: ", desiredArtistIds)

    // Resolve all promises.
    return Promise.all(promisesArtistsCall).then((response) => {

      console.log("response: ", response.data)
      // Now you have all the artists, loop through them all.
      const genreCheckArtists = []

      for (let i = 0; i < response[0].data.artists.length; i++) {
        // Check
        if (lengthGenres == 0 || validateGenres(response[0].data.artists[i], genres)) {
          genreCheckArtists.push(response[0].data.artists[i].id)
        }
      }

      // Now go through tracks and if it contains any artists that pased above checks add them.
      for (let i = 0; i < tempTracks.length; i++) {
        // check if the track contains any artists that pass check.

        const artists = tempTracks[i].track.artists

        for (let j = 0; j < artists.length; j++) {
          if (genreCheckArtists.includes(artists[j].id)) {
            if (!(trackURIs.includes(tempTracks[i].track.uri))) {
              numberOfTracks = trackURIs.push(tempTracks[i].track.uri)
            }
            break
          }
        }
      }
      return Promise.all(promisesInner).then(function (resp) {
        if (numberOfTracks != 0 && oldTracks.length == 0) {
          console.log("NO")
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
        } else if (oldTracks.length != 0) {
            //Playlist already exists.
          console.log("HERE?")
            //Here do your track URIs comparison and old. Then, add tracks and remove accordingly.

            let tracks = compareTracks(oldTracks, trackURIs)
            console.log("TRACSK[2]: ", tracks[2])

            return putTracksInPlaylist(tracks[0], existingPlaylistId).then((response) => {
                return removeTracksInPlaylist(tracks[1], existingPlaylistId).then((res) => {
                    //Change playlist name if it applies?
                  if (oldPlaylistName != playlistName) {
                      return updateNameOfPlaylist(playlistName, existingPlaylistId).then((res) => {
                        return tracks[2]
                      })
                  }
                  return tracks[2]
                }).catch(err => console.log(err))
            }).catch(err => console.log(err))


        }
      }).catch(function (err) {
        console.log("error here: ", err.message)
        throw new Error('Error in resolving promises in parsing playlist')
      })
    })
  })
    .catch(function (err) {
      console.log('errrewqr: ', err)
      throw new Error('Error in resolving promises in parsing playlist')
    })
}

function getPlaylistId (input = '', artistsOfInterest, genresOfInterest, yearAfterInterest, playlistName='', edit=false) {

  let isSpotifyLink = false
  let playlist = input

  if (!edit) {
    const playlistIDLength = 22
    const URL = input.split('/')
    playlist = ''
    const spotifyLink = 'open.spotify.com'
 

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
  } else {
    isSpotifyLink = true;

  }
  
  if (!playlistName.trim())
    playlistName = "New Playlist"

  if (artistsOfInterest == '') { artistsOfInterest = [] } else { artistsOfInterest = artistsOfInterest.split(',') }

  if (genresOfInterest == '') { genresOfInterest = [] } else { genresOfInterest = genresOfInterest.split(',') }


  return [playlist, isSpotifyLink, artistsOfInterest, genresOfInterest, yearAfterInterest, playlistName]
}

//Add a paramter with track URIs in existing.
async function enterPlaylist (access_token, artistsOfInterest, genresOfInterest, yearAfterInterest, playlistName, playlist, isSpotifyLink, oldTracks=[], playlistExisting='', oldPlaylistName='') {
  const artistsMap = {}
  const genresMap = {}

  accessToken = access_token
  
  console.log("params: ", artistsOfInterest, genresOfInterest, yearAfterInterest, playlistName, playlist, isSpotifyLink, oldTracks, playlistExisting)
  // enterPlaylist(accessTokenGlobal, values[2], values[3], req.body.yearEnter, req.body.playlistName, playlist[0].playlistIdRef, true, playlist[0].tracks, playlist[0].playlistId)

  for (let i = 0; i < artistsOfInterest.length; i++) {
    artistsMap[artistsOfInterest[i].toUpperCase()] = 1
  }

  for (let i = 0; i < genresOfInterest.length; i++) {
    genresMap[genresOfInterest[i].toUpperCase()] = 1
  }
  console.log("map of artists: ", artistsMap)

  if (isSpotifyLink && playlist != '') {
    // Create a new playlist.
    // Make a GET request to get the playlist information.
    return await axios
      .get(
            `https://api.spotify.com/v1/playlists/${playlist}`, {
              headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
              }
            }).then((response) => {
        return parsePlaylist(response, genresMap, artistsMap, yearAfterInterest, playlistName, oldTracks, playlistExisting, oldPlaylistName)
      }).catch((err) => {
        //console.log('err inside: ', err.response)
        if (err.message == 'No artists, genres, or year entered') {
          throw new Error('No artists, genres, or year entered')
        } else if (err.message == 'Please enter an artist if genres are entered') {
          throw new Error('Please enter an artist if genres are entered')
        }
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
