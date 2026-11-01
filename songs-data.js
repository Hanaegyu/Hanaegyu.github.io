// Your song gallery. Each song is one line: [title, artist, YouTube link, playlist]
// Leave a part empty with "" if you don't have it. Keep a comma at the end of every line.
// Only link to official uploads (the artist's or label's own channel).
const SONGS = [
   ["Take My Hand (VIVINOS - ALNST Sub : Hyuna Part.3)","6FU;","https://youtu.be/qUgzvgT4eM0?si=iijQVIW_gYCVm92Y","ALIEN STAGE"],
  ["Ruler Of My Heart (VIVINOS - ALNST 2nd Anniversary Remix Part.3)","6FU;","https://youtu.be/CaDU1fRXaOs?si=RCpusqvOrKahlykz","ALIEN STAGE"],
  ["Paratise (VIVINOS - ALNST Sub : Ivan Part.2)","Park Byeonghoon","https://youtu.be/ekSuZga5cM8?si=-XtdFPBG-e58cl1u","ALIEN STAGE"],
  ["All-In (VIVINOS - ALNST Original Soundtrack Part.6)","6FU;","https://youtu.be/LBzAlKtgkZU?si=vFmMoy_1nZ2iZaWO","ALIEN STAGE"],
  ["KARMA (VIVINOS - ALNST Original Soundtrack Part.10)","Rubyeye · C!naH","https://youtu.be/EfhfpOre98k?si=_APryxy5uMx4MsXa","ALIEN STAGE"],
  ["Wiege (VIVINOS - ALNST Original Soundtrack Part.9)","BL8M · 6FU;","https://youtu.be/DDea4MGjGk0?si=X-6m8JiYEDxEhf8o","ALIEN STAGE"],
  ["Drunk & Party (VIVINOS - ALNST Sub : Hyuna Part.2)","6FU;","https://youtu.be/T6Y-C6RJCM4?si=2uT7Vopsjk3ykohi","ALIEN STAGE"],
  ["Nowhere (VIVINOS - ALNST Sub : Ivan Part.1)","Park Byeonghoon","https://youtu.be/g6HahdpLNx0?si=3J5gSENAPJRLKeiC","ALIEN STAGE"],
  ["My Clematis (VIVINOS - ALNST Original Soundtrack Part.1)","Rubyeye · C!naH","https://youtu.be/tPgngMS9Yi0?si=lKDc5Ik9ehSUPPb0","ALIEN STAGE"],
  ["Unknown (Till The End...) (VIVINOS - ALNST Original Soundtrack Part.3)","AKUGETSU","https://youtu.be/5sLMPdsPgY0?si=Js4gSgp1ugHTYUHL","ALIEN STAGE"],
  ["Black Sorrow (VIVINOS - ALNST Original Soundtrack Part.4)","Park Byeonghoon","https://youtu.be/1-PMBxtN4N0?si=u-p45eepAPOAx_Ox","ALIEN STAGE"],
  ["Ruler of My Heart (VIVINOS - ALNST Original Soundtrack Part.5)","BL8M · Rubyeye","https://youtu.be/erPCW45lHHM?si=gO1Cdpno9KcBhA7h","ALIEN STAGE"],
  ["Cure (VIVINOS - ALNST Original Soundtrack Part.7)","AKUGETSU · Park Byeonghoon","https://youtu.be/JqIs6zDR_xg?si=JscIv1xHrW83XI2z","ALIEN STAGE"],
  ["Blink Gone (VIVINOS - ALNST Original Soundtrack Part.8)","BL8M · AKUGETSU","https://youtu.be/o3Z2k-bhoUo?si=f_n95llAjCftXbbt","ALIEN STAGE"],
  ["Love & Peace (VIVINOS - ALNST Sub : Hyuna Part.1)","6FU;","https://youtu.be/AzUWnGYNpuE?si=_dNo-zHb7Y7fJr2f","ALIEN STAGE"],
  ["21st Century Romance", "TOMMOROW X TOGETHER", "https://youtu.be/JnSqh9VJ0Yc?si=OkAbyh5D4SWP-F1K", "TXT"],
  ["Our Summer","TOMMOROW X TOGETHER","https://youtu.be/IT6wxL0adPQ?si=sATpareoQKZicqBU","TXT"],
  ["Nap of a star","TOMMOROW X TOGETHER","https://youtu.be/ZbIs7AOZ8Ls?si=Xm49Qqf32P4lXv8e","TXT"],
  ["20cm","TOMMOROW X TOGETHER","https://youtu.be/vKOOoji5aAg?si=WMydzMd2JopaGU4j","TXT"],
  ["Still Together Ost.","BRIGHT, WIN METAWIN","https://youtu.be/-baxAeq-MlU?si=ktKmx3mYmhwpYIko","Fav"],
];

// Optional: link a playlist name to its real YouTube playlist page.
// Example:  "Reading soundtrack": "https://www.youtube.com/playlist?list=...",
const PLAYLIST_LINKS = {
  "Favourites": ""
};