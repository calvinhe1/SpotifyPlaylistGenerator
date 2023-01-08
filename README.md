# Spotify Playlist Generator

An application that filters existing playlists based on certain criteria (genres, artists, year added), and generates new playlists with the criteria applied.

# About the project

The motivation for this project comes from the fact that I have a huge playlist on Spotify that I use frequently, and there are times when I want to listen to certain artists or certain genres of songs. The issue with this is I would have to create an entirely new playlist based on the huge playlist and update it manually for any songs that I want to be added/removed, which consumes a sizable amount of time.

With this motivation, I decided to create an application that allows for the creation of playlists based on filtering an existing playlist and have the playlists be updated automatically by scraping data from the original playlist.

## Creating a playlist

1. Login with Spotify and allow access to certain permissions needed
2. Using the create form, provide the link of an existing Spotify playlist
3. Provide the genres of interest separated by commas based on the following link: [Every Noise at Once](https://everynoise.com/everynoise1d.cgi?scope=all), however can provide short-form genres as well, as the program is flexible on substrings. E.g. typing in pop considers all genres that have the word “pop” in it within the playlist
    * Example: pop,rap
4. Provide the artists of interest separated by commas
    * Example: Khalid,Billie Eilish,Justin Bieber
5. Provide the earliest year date songs are added to the playlist that you want filtered. E.g. typing in 2022 would consider all songs added starting from 2022 and forward
    * Example: 2022
6. Provide a playlist name
7. Click on ‘Create Playlist’
8. On your Spotify account, you will see the newly generated playlist with all of the applied filters on the target playlist in step #2

## Editing a playlist

If a user wants to change the filters for a created playlist, e.g. want to consider additional artists or no longer consider a genre, then the user can select the “Playlists” button above, select the desired playlist, then edit the form the same way the form was filled out in the creating playlist step. 

When the user is finished filling out the form, the existing playlist will be updated (tracks that no longer fit the filters will be removed, and new tracks that are will be added based on the referenced playlist).


## Deleting a playlist 

When a user no longer wants a playlist, they can delete it from the playlists page and it will be deleted in the user’s Spotify account.

# Demos

## Creating a playlist
https://user-images.githubusercontent.com/66074281/211185689-7721953d-c364-48d8-b43a-3c4ebd0d731d.mp4



In this video, the "Test Playlist" playlist is being used as a reference, and the playlist is filtered based on songs that have Khalid as an artist, pop as a genre, and 2022 as the earliest date a song can be added. A resulting playlist called "Khalid only!" is created as a result in the user's Spotify library.

## Editing a playlist

https://user-images.githubusercontent.com/66074281/211185349-6b4326c2-2a80-4374-bdbc-5599d92cc5a7.mp4

If a user wants to edit the options they filtered with for the newly created playlist, they can view the playlists page and change any fields. In this video, Kupla is added as an artist, lo-fi is added as a genre as the new filtering options, and the name of the playlist is updated. As a result, the playlist created in the previous video was updated with new songs that come from the original reference playlist that pass the new filters, along with a new name.

## Deleting a playlist
https://user-images.githubusercontent.com/66074281/211185354-c766f02b-bb41-4413-bb4b-fbf794d99bf9.mp4

In this video, an existing playlist created from this application is deleted in the playlists page, which deletes it from the Spotify library.


## Notes
There will a job run by the Heroku Scheduler that runs daily to update the created playlists in this application. 
E.g. if a new song is added to a referenced playlist that fits the filters for a created playlist, the created playlist will have the new song added.

With this job, there is no need to enter the application and refilter an existing playlist, this will be done automatically and songs will be removed or added based on the referenced playlist.

### Deployment
The application is currently deployed on Heroku here: https://whispering-falls-70349.herokuapp.com, but it is not currently usable in production for non-added users to my Spotify development application. 

To run it locally, fork this repo and create your own Spotify application: https://developer.spotify.com/ with your own client secret, client id, and redirect URI. Then update `index.js` with those values.



