
function putTracksInPlaylist(trackURIs, playlistId) {
    //New playlist, put tracks inside.

    //Split it.


function putTracksInPlaylist(trackURIs, playlistId) {
    //New playlist, put tracks inside.
    let numberOfCalls = Math.ceil(trackURIs.length / 100);
    for (let i=0; i<numberOfCalls; i++) {

        //limit of 100 tracks per API request
        let groupOfTracks = trackURIs.slice(0,100)
        console.log("Group: ", groupOfTracks)
        //NoW: put your tracks in playlist with all your URIs.
        //Note: only works for up to 100?
        axios({
            method: 'post',
            url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
            data: {
                uris: groupOfTracks
            },
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' +  access_token,
                'Content-Type': 'application/json',
            },
        }).then((response)=> {
            console.log("snapshot: ", response)
        }).catch((err) => {
            console.log("Error in putting tracks in playlist! ", err)
        })

        let noMoreTracks = false;
        for (let j=0; j<100; j++) {
            if (trackURIs.length <=0) {
                noMoreTracks = true;
                break;
            }

            trackURIs.shift()
        }

        if (noMoreTracks) {
            break;
    }
    }
}

function createPlaylist(userId, trackURIs, playlistName="New Playlist") {
    //the refresh token scope is wrong?

    console.log("PLAYLIST NAME: ", playlistName)

    axios({
        method: 'post',
        url: `https://api.spotify.com/v1/users/${userId}/playlists`,
        data: {
            name: playlistName,
            public: false
        },
        headers: {
            Accept: 'application/json',
            Authorization: 'Bearer ' +  access_token,
            'Content-Type': 'application/json',
        },
    }).then((response)=> {
        //Repsponse id is your playlist ID
        putTracksInPlaylist(trackURIs, response.data.id)
    }).catch((err) => {
        console.log("Error in creating playlist", err)
    })

}

function validateGenres(response, genresOfInterest) {
    for (let i=0; i<response.genres.length; i++) {
        if (response.genres[i] in genresOfInterest)
            return true;
    }

    return false;
}


function parsePlaylist(response, genres, artists, year, playlistName) {
  


    //Go through the playlist JSON
    //Can get genre information from artist information
    const tracks = response.data.tracks;
    let trackURIs = [];

    let tempTracks = tracks.items
    let promises = [];
    let promisesInner = [];
    let  numberOfTracks = 0
    const lengthArtists = Object.keys(artists).length;
    const lengthGenres = Object.keys(genres).length;


    if (lengthArtists == 0 && lengthGenres == 0 && year == '') {
        console.log("no artist, genre or year entered!")
        return;
    }
    if (year)
        year - 1
    let numberOfCalls = Math.floor(tracks.total / 100);

    let originalLink = tracks.href.split("?")[0]
    for (let i=0; i<numberOfCalls; i++) {

        nextLink = originalLink + `?offset=${(i+1)*100}&limit=100`
    
        let promise =
        axios
        .get(
            nextLink, {
                headers: {
                    Accept: 'application/json',
                    Authorization: 'Bearer ' +  access_token,
                    'Content-Type': 'application/json',
                },
        }).then((response)=> {
            console.log("RESPONSE: ", response)
            tempTracks = tempTracks.concat(response.data.items)
        }).catch((err) => {
            console.log("Unable to extract spotify playlist", err)
        })

        promises.push(promise)



        //Tracks.next only works for 2 slides.
    }
    
    //How about construct all your tracks before doing any processing.
    Promise.all(promises).then(function(resp) {

        //Execute code here.
        for (let i=0; i<tempTracks.length; i++) {
            if (year != "" && new Date(tempTracks[i].added_at) < new Date(year)) {
                continue;
            }
            //Go through artists and check if any fall in the map, if so, this track is good.
            let desiredArtistIds = [];
            let artistsOfTrack = tempTracks[i].track.artists;

            for (let j =0; j<artistsOfTrack.length; j++) {
                if (artistsOfTrack[j].name in artists) {
                    desiredArtistIds.push(artistsOfTrack[j].id)
                }
            }
        
            if (lengthArtists != 0 && desiredArtistIds.length == 0) {
                continue;
            }

            else {
                //Call API to desired artists, and check what genre the desiredArtist(s) belongs to.
                promisesInner = []
                let promise;
                for (let j=0; j<desiredArtistIds.length; j++) {
                    promise = axios
                    .get(
                        `https://api.spotify.com/v1/artists/${desiredArtistIds[j]}`, {
                            headers: {
                                Accept: 'application/json',
                                Authorization: 'Bearer ' +  access_token,
                                'Content-Type': 'application/json',
                            },
                    }).then((response)=> {
                        //Call a funciton that validates genres, if so mark this track as a canditate.
                        if (lengthGenres == 0 || validateGenres(response, genres, trackURIs)) {
                            if (!(trackURIs.includes(tempTracks[i].track.uri)))  {
                                numberOfTracks = trackURIs.push(tempTracks[i].track.uri);
                            }
                        }

                    }).catch((err) => {
                        console.log(`Error in getting artist ID: ${desiredArtistIds[j]}`, err)
                    })
                }
                //Need to resolve all the above axios requests before getting final list of track URIs.
                if (promise)
                    promisesInner.push(promise)
            }

            //If no genre and no artist and just a year condition, then add, otherwise leave it to above.
            if (lengthArtists == 0 && lengthGenres == 0) {
                //Promises
                numberOfTracks = trackURIs.push(tempTracks[i].track.uri)
            }

        }

        //Resolve all axios promises here.
        Promise.all(promisesInner).then(function(resp) {
        //Get the user_id.
            if (numberOfTracks != 0) {
        axios
        .get(
            `https://api.spotify.com/v1/me`, {
                headers: {
                    Accept: 'application/json',
                    Authorization: 'Bearer ' +  access_token,
                    'Content-Type': 'application/json',
                },
        }).then((response)=> {
            //Call a funciton that validates genres, if so mark this track as a canditate.
                    console.log("Response: ", response)
                    createPlaylist(response.data.id, trackURIs,playlistName)

        }).catch((err) => {
            console.log(`Error in getting artist ID: ${desiredArtistIds[j]}`, err)
                })
            }
        })
    })
    .catch(function(err) {
        console.log("error! ", err)
    })
}

function enterPlaylist() {
    refreshAccessToken();
    //If no event listener add one.

    //Parse the playlist 
    const input = document.getElementById('playlistEnter').value

    const artistsOfInterest = document.getElementById('artistsEnter').value == '' ?  [] : document.getElementById('artistsEnter').value.split(",")
    const genresOfInterest  = document.getElementById('genresEnter').value == '' ? [] : document.getElementById('genresEnter').value.split(",")
    const yearAfterInterest  = document.getElementById('yearEnter').value
    const playlistName = document.getElementById('playlistName').value == '' ? "New Playlist" : document.getElementById('playlistName').value 

    let artistsMap = {};
    let genresMap = {};

    for (let i=0; i<artistsOfInterest.length; i++) {
        artistsMap[artistsOfInterest[i]] = 1
    }

    for (let i=0; i<genresOfInterest.length; i++) {
        genresMap[genresOfInterest[i]] = 1
    }

    const playlistIDLength = 22;
    const URL = input.split("/");
    let playlist = '';
    let spotifyLink = "open.spotify.com"
    let isSpotifyLink = false;

    //extract genres and artists, date added.
    for (let i=0; i<URL.length; i++) {
        if (URL[i]== spotifyLink)
            isSpotifyLink = true;
        else if (URL[i].length >= playlistIDLength) {
            //browser link
            if (URL[i].length == playlistIDLength) {
                playlist = URL[i];
            } else {
                playlist = URL[i].split("?")
                playlist = playlist[0];
            }
        }   
    }
    if (isSpotifyLink && playlist != '') {
        //Create a new playlist.
        //Make a GET request to get the playlist information.
        axios
        .get(
            `https://api.spotify.com/v1/playlists/${playlist}`, {
                headers: {
                    Accept: 'application/json',
                    Authorization: 'Bearer ' +  access_token,
                    'Content-Type': 'application/json',
                },
        }).then((response)=> {
            parsePlaylist(response, genresMap, artistsMap, yearAfterInterest, playlistName)
        }).catch((err) => {
            throw new Error("Unable to extract spotify playlist", err)
        })
    }

}

