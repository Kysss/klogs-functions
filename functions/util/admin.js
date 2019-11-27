var admin = require("firebase-admin");
//project setting -> service accounts -> get service private key and see snippets for reference
var serviceAccount = require("../klogs-61e15-firebase-adminsdk-aaxch-621ae3e6ef.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://klogs-61e15.firebaseio.com"
});
const db = admin.firestore();

module.exports = { admin, db }