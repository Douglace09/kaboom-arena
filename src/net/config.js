// Adresse du serveur de jeu.
// En local (npm run dev), le jeu utilise le serveur lancé sur ton PC avec « npm run server ».
// En ligne, remplace l'adresse ci-dessous par celle de ton Web Service Render,
// en gardant « wss:// » au début (exemple : wss://kaboom-arena-serveur.onrender.com).
const ONLINE_SERVER = 'wss://kaboom-arena-serveur.onrender.com';

const local = ['localhost', '127.0.0.1'].includes(location.hostname);
export const SERVER_URL = local ? `ws://${location.hostname}:3000` : ONLINE_SERVER;
