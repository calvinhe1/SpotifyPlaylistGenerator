
let accessToken = null
const axios = require('axios')

// Unfollow the playlist, which will delete it.
function deletePlaylist (accessToken, playlistId) {
  const promise = axios({
    method: 'delete',
    url: `https://api.spotify.com/v1/playlists/${playlistId}/followers`,
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    }
  }).then((response) => {
    return response
  }).catch((err) => {
    if (err.response.status == 404) {
      throw new Error("Playlist no longer exists")
    } else {
      throw new Error('Error removing tracks in playlist')
    }
  })

  return promise.then((response) => {
    return response
  }).catch((err) => {
    if (err.message == "Playlist no longer exists") {
      throw new Error("Playlist no longer exists")
    } else {
      throw new Error('Error removing tracks in playlist')
    }
  })
}

function updateNameOfPlaylist (accessToken, playlistNameNew, playlistId) {
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

  return promise.then((response) => {

  }).catch((err) => {
    throw new Error('Failed to change playlist name for existing playlist.')
  })
}

function removeTracksInPlaylist (accessToken, trackURIs, playlistId) {
  const numberOfCalls = Math.ceil(trackURIs.length / 100)

  const formattedData = []

  for (let i = 0; i < trackURIs.length; i++) {
    const obj = {}
    obj.uri = trackURIs[i]
    formattedData.push(obj)
  }

  const promises = []
  for (let i = 0; i < numberOfCalls; i++) {
    // limit of 100 tracks per API request
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
    }).catch((err) => {
      throw new Error('Error removing tracks in playlist')
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
  }).catch((err) => {
    throw new Error('Error resolving promises for removing tracks in playlist')
  })
}

function putTracksInPlaylist (accessToken, trackURIs, playlistId) {
  const numberOfCalls = Math.ceil(trackURIs.length / 100)
  const copyOfTrackURIs = [...trackURIs]
  const promises = []

  for (let i = 0; i < numberOfCalls; i++) {
    // limit of 100 tracks per API request
    const groupOfTracks = trackURIs.slice(0, 100)

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
    }).catch((err) => {
      throw new Error('Error putting tracks in playlist')
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
    return [copyOfTrackURIs, playlistId]
  }).catch((err) => {
    throw new Error('Error resolving promises for putting tracks in playlist')
  })
}

function createPlaylist (accessToken, userId, trackURIs, playlistName) {
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
    return putTracksInPlaylist(accessToken, trackURIs, response.data.id)
  }).catch((err) => {
    throw new Error('Error creating playlist')
  })
}

function validateGenres (response, genresOfInterest) {
  for (const genre in genresOfInterest) {
    for (let j = 0; j < response.genres.length; j++) {
      if (response.genres[j].toUpperCase().includes(genre)) { return true }
    }
  }
  return false
}

function compareTracks (oldTracks = [], newTracks = []) {
  // Get final list of NEW addition tracks and traacks that NEED to be removed.
  // New list of tracks subtract tracks already in -> Tracks that need to be added
  // Old tracks that do not belong in NEW tracks -> Tracks that need to be removed.
  const newMap = {}

  for (let i = 0; i < newTracks.length; i++) {
    newMap[newTracks[i]] = 1
  }

  const removeTracks = []
  const existingTracks = {}
  const addTracks = []

  for (let i = 0; i < oldTracks.length; i++) {
    if (!(oldTracks[i] in newMap)) {
      removeTracks.push(oldTracks[i])
    } else {
      existingTracks[oldTracks[i]] = 1
    }
  }

  for (let i = 0; i < newTracks.length; i++) {
    if (!(newTracks[i] in existingTracks)) {
      addTracks.push(newTracks[i])
    }
  }

  return [addTracks, removeTracks, newTracks]
}

function parsePlaylist (accessToken, response, genres, artists, year, playlistName, oldTracks = [], existingPlaylistId = '', oldPlaylistName = '') {
  const tracks = response.data.tracks
  const trackURIs = []
  let tempTracks = tracks.items
  const promises = []
  const lengthArtists = Object.keys(artists).length
  const lengthGenres = Object.keys(genres).length

  if (lengthArtists == 0 && lengthGenres == 0 && year == '') {
    throw new Error('No artists, genres, or year entered')
  }

  const numberOfCalls = Math.floor(tracks.total / 100)

  let nextLink

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
            tempTracks = tempTracks.concat(response.data.items)
          }).catch((err) => {
            throw new Error('Error in GET playlist')
          })

    promises.push(promise)
  }

  return Promise.all(promises).then(function (resp) {
    let desiredArtistIds = []

    for (let i = 0; i < tempTracks.length; i++) {
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
    }
    desiredArtistIds = [...new Set(desiredArtistIds)]

    const numberOfCalls = Math.ceil(desiredArtistIds.length / 50)
    const promisesArtistsCall = []
    for (let i = 0; i < numberOfCalls; i++) {
      const currentArtists = desiredArtistIds.slice(i * 50, (i + 1) * 50)
      const stringArtists = currentArtists.toString()
      const promise = axios({
        method: 'get',
        url: 'https://api.spotify.com/v1/artists' + '?ids=' + stringArtists,
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        }
      }).then((res) => {
        return res
      })
        .catch((err) => {
          throw new Error('Failed to GET artists information')
        })
      promisesArtistsCall.push(promise)
    }

    // Resolve all promises.
    return Promise.all(promisesArtistsCall).then((response) => {
      const genreCheckArtists = []

      for (let numCalls = 0; numCalls < response.length; numCalls++) {
        if (desiredArtistIds.length != 0) {
          for (let i = 0; i < response[numCalls].data.artists.length; i++) {
            //Check if artists' genres are a part of desired genres
            if (lengthGenres == 0 || validateGenres(response[numCalls].data.artists[i], genres)) {
              genreCheckArtists.push(response[numCalls].data.artists[i].id)
            }
          }
        }
      }
      // Now go through tracks and if it contains any artists that pased above checks add them.
      for (let i = 0; i < tempTracks.length; i++) {
        // check if the track contains any artists that pass check.
        if (year != '' && new Date(tempTracks[i].added_at) < new Date(year)) {
          continue
        }
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
      if (oldTracks.length == 0 && oldPlaylistName == '') {
        return axios
          .get(
            'https://api.spotify.com/v1/me', {
              headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
              }
            }).then((response) => {
            return createPlaylist(accessToken, response.data.id, trackURIs, playlistName)
              .catch((err) => {
                throw new Error('Error in creating playlist')
              })
          }).catch((err) => {
            if (err.message == 'Error in creating playlist') { throw new Error('Error in creating playlist') } else { throw new Error('Error in getting spotify user ID') }
          })
      } else {
        const tracks = compareTracks(oldTracks, trackURIs)
        return putTracksInPlaylist(accessToken, tracks[0], existingPlaylistId).then((response) => {
          return removeTracksInPlaylist(accessToken, tracks[1], existingPlaylistId).then((res) => {
            // Check if playlist name needs to change
            if (oldPlaylistName != playlistName) {
              return updateNameOfPlaylist(accessToken, playlistName, existingPlaylistId).then((res) => {
                return tracks[2]
              }).catch((err) => {
                throw new Error('Failed to change playlist name for existing playlist.')
              })
            }
            return tracks[2]
          }).catch((err) => {
            if (err.message == 'Failed to change playlist name for existing playlist.') { throw new Error('Failed to change playlist name for existing playlist.') }
            throw new Error('Failed to remove tracks for existing playlist.')
          })
        }).catch((err) => {
          if (err.message == 'Failed to change playlist name for existing playlist.') { throw new Error('Failed to change playlist name for existing playlist.') } else if (err.message == 'Failed to remove tracks for existing playlist.') { throw new Error('Failed to remove tracks for existing playlist.') } else { throw new Error('Failed to add new tracks to existing playlist.') }
        })
      }
    })
  }).catch(function (err) {
    if (err.message == 'Failed to GET artists information') {
      throw new Error('Failed to GET artists information')
    } else if (err.message == 'Error in GET playlist') {
      throw new Error('Error in GET playlist')
    } else if (err.message == 'Error in getting spotify user ID') {
      throw new Error('Error in getting spotify user ID')
    } else if (err.message == 'Failed to remove tracks for existing playlist.') {
      throw new Error('Failed to remove tracks for existing playlist.')
    } else if (err.message == 'Failed to add new tracks to existing playlist.') {
      throw new Error('Failed to add new tracks to existing playlist.')
    } else if (err.message == 'Error in resolving promises in parsing playlist') {
      throw new Error('Error in resolving promises in parsing playlist')
    } else if (err.message == 'Error in creating playlist') {
      throw new Error('Error in creating playlist')
    } else if (err.message == 'Failed to change playlist name for existing playlist.') { throw new Error('Failed to change playlist name for existing playlist.') }
      throw new Error("Miscellaneous error")
  })
}

function getPlaylistId (input = '', artistsOfInterest, genresOfInterest, yearAfterInterest, playlistName = '', edit = false) {
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
    isSpotifyLink = true
  }

  if (!playlistName.trim()) { playlistName = 'New Playlist' }

  if (artistsOfInterest == '') { artistsOfInterest = [] } else { artistsOfInterest = artistsOfInterest.split(',') }

  if (genresOfInterest == '') { genresOfInterest = [] } else { genresOfInterest = genresOfInterest.split(',') }

  return [playlist, isSpotifyLink, artistsOfInterest, genresOfInterest, yearAfterInterest, playlistName]
}

async function enterPlaylist (access_token, artistsOfInterest, genresOfInterest, yearAfterInterest, playlistName, playlist, isSpotifyLink, oldTracks = [], playlistExisting = '', oldPlaylistName = '') {
  const artistsMap = {}
  const genresMap = {}


  if (!isSpotifyLink || playlist == '') { throw new Error('Please enter a playlist link from Spotify') }

  for (let i = 0; i < artistsOfInterest.length; i++) {
    artistsMap[artistsOfInterest[i].toUpperCase()] = 1
  }

  for (let i = 0; i < genresOfInterest.length; i++) {
    genresMap[genresOfInterest[i].toUpperCase()] = 1
  }

  if (isSpotifyLink && playlist != '') {
    // Make a GET request to get the playlist information.
    return await axios
      .get(
            `https://api.spotify.com/v1/playlists/${playlist}`, {
              headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' + access_token,
                'Content-Type': 'application/json'
              }
            }).then((response) => {
        return parsePlaylist(access_token, response, genresMap, artistsMap, yearAfterInterest, playlistName, oldTracks, playlistExisting, oldPlaylistName)
      }).catch((err) => {
        if (err.response && err.response.status == 404) { 
          throw new Error('Playlist no longer exists')
        } else if (err.message == 'No artists, genres, or year entered') {
          throw new Error('No artists, genres, or year entered')
        } else if (err.message == 'Error in GET playlist') {
          throw new Error('Error in GET playlist')
        } else if (err.message == 'Failed to GET artists information') {
          throw new Error('Failed to GET artists information')
        } else if (err.message == 'Error in getting spotify user ID') {
          throw new Error('Error in getting spotify user ID')
        } else if (err.message == 'Failed to remove tracks for existing playlist.') {
          throw new Error('Failed to remove tracks for existing playlist.')
        } else if (err.message == 'Failed to add new tracks to existing playlist.') {
          throw new Error('Failed to add new tracks to existing playlist.')
        } else if (err.message == 'Error in resolving promises in parsing playlist') {
          throw new Error('Error in resolving promises in parsing playlist')
        } else if (err.message == 'Error in creating playlist') {
          throw new Error('Error in creating playlist')
        } else if (err.message == 'Failed to change playlist name for existing playlist.') { throw new Error('Failed to change playlist name for existing playlist.') }
      })
  }
}

module.exports = { enterPlaylist, getPlaylistId, deletePlaylist }
