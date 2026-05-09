const yts = require('yt-search');

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

async function searchMusic(query) {
  const q = cleanText(query);
  if (!q) return [];

  const result = await yts(`${q} official audio music`);
  const videos = (result.videos || []).slice(0, 18);

  return videos.map((v) => ({
    id: v.videoId,
    songId: v.videoId,
    videoId: v.videoId,
    title: cleanText(v.title),
    artist: cleanText(v.author && v.author.name ? v.author.name : 'YouTube'),
    cover: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    duration: v.timestamp || '',
    url: `https://www.youtube.com/watch?v=${v.videoId}`
  }));
}

module.exports = { searchMusic };
