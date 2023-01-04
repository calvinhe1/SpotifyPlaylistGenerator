# Spotify Playlist Generator

An application that filters existing playlists based on certain criteria (genres, artists, year added), and generates new playlists with the criteria applied.

# About the project

The motivation for this project comes from the fact that I have a huge playlist on Spotify that I use frequently, and there are times where I want to listen to certain artists or certain genres of songs. The issue with this is I would have to create an entirely new playlist based on the huge playlist and update it manually for any songs that I want added/removed, which consumes a sizable amount of time.

With this motivation, I decided to create an application that allows for the creation of playlists based on a given existing playlist, and have the playlists be updated automatically by scraping data from the original playlist.

## Creating a playlist

1. Login with Spotify and allow access to certain permissions needed
2. Using the create form, provide the link of an existing Spotify playlist
3. Provide the genres of interest separated by commas based on the following link: [Every Noise at Once], however can provide short-form genres as well, as the program is flexible on substrings. E.g. typing in pop considers all genres that have the word “pop” in it within the playlist
..* Example: pop,rap
4. Provide the artists of interest separated by commas 	.
..* Example: Khalid,Billie Eilish,Justin Bieber
5. Provide the earliest year date songs are added to the playlist that you want filtered. E.g. typing in 2022 would consider all songs added starting from 2022 and forward
..* Example: 2022
6. (Optional) Provide a playlist name
7. Click on ‘Create Playlist’
8. On your spotify account, you will see the newly generated playlist with all of the applied filters on the target playlist in step #2

## Working Example 

### Login Page
![Index](https://user-images.githubusercontent.com/66074281/210477400-0f1a4775-9109-4dee-80e6-5e60f506a78d.png)

### Create Page
![Create](https://user-images.githubusercontent.com/66074281/210477316-e13064e1-86f9-4402-bca8-d34b6dae3dca.png)

### Playlists Page
![Playlists](https://user-images.githubusercontent.com/66074281/210477414-d9457f80-2ebb-4387-87f4-9d29a9ffc0be.png)

## Editing a playlist

If a user wants to change the filters for a created playlist, e.g. want to consider additional artists or no longer consider a genre, then the user can select “Playlists” button above, select the desired playlist, then edit the form the same way the form was filled out in the creating playlist step. 

When the user is finished filling out the form, the existing playlist will be updated (remove the tracks that no longer fit the filters and add new tracks from the referenced playlist).

## Deleting a playlist 

When a user no longer wants a playlist, they can delete it in the playlists page and it will be deleted in the user’s Spotify account.

## Notes
There will a job that runs daily to update the created playlists in this application. 
E.g. if a new song is added to the referenced playlist that fits the filters for a created playlist, the created playlist will have the new song added.

With this job, there is no need to enter the application and refilter an existing playlist, this will be done automatically and songs will be removed or added based on the referenced playlist.

### Deployment
The application is currently deployed on Heroku, but pending approval from Spotify (which takes about 6 weeks), so it is not currently usable in production for non-added users to my Spotify development application. 



