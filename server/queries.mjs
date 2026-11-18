const ENTRY = `status progress progressVolumes repeat updatedAt score(format: POINT_100)
 startedAt { year month day } completedAt { year month day }
 media { id siteUrl type format duration episodes chapters meanScore countryOfOrigin bannerImage
 title { userPreferred } coverImage { large extraLarge } genres studios(isMain: true) { nodes { name } } }`;
export const INITIAL = `query Archive($name: String) {
 User(name: $name) { id name avatar { large } bannerImage favourites {
 characters(perPage: 12) { nodes { name { full } image { large } media(perPage: 1) { nodes { title { userPreferred } } } } }
 staff(perPage: 10) { nodes { name { full } } } } }
 anime: MediaListCollection(userName: $name, type: ANIME, chunk: 1, perChunk: 250) { hasNextChunk lists { entries { ${ENTRY} } } }
 manga: MediaListCollection(userName: $name, type: MANGA, chunk: 1, perChunk: 250) { hasNextChunk lists { entries { ${ENTRY} } } }
}`;
export const NEXT = `query ArchiveChunk($id: Int, $type: MediaType, $chunk: Int) {
 collection: MediaListCollection(userId: $id, type: $type, chunk: $chunk, perChunk: 250) { hasNextChunk lists { entries { ${ENTRY} } } }
}`;
