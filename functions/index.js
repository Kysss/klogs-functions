const functions = require('firebase-functions');


const express = require('express');
//const app = express();
const app = require('express')();
const { db } = require('./util/admin');

const FBAuth = require('./util/fbAuth');
const {
    getAllKposts,
    postOneKpost,
    getKpost,
    commentOnKpost,
    likeKpost,
    unlikeKpost,
    deleteKpost } = require('./handlers/kpost');
const { signup,
    login,
    uploadImage,
    addUserDetails,
    getAuthenticatedUser,
    getUserDetails,
    markNotificationsRead
} = require('./handlers/users');

const cors = require('cors')({
    origin: true
  });

// const firebase = require('firebase');
// firebase.initializeApp(firebaseConfig);



// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

//get existing k posts by all users
// exports.getKpost=functions.https.onRequest((req,res)=>{

//     admin
//         .firestore()
//         .collection('kposts')
//         .get()
//         .then( (data)=>{
//             let kposts = [];
//             data.forEach((doc)=>{
//                 kposts.push(doc.data());
//             });
//             return res.json(kposts);
//         })
//         .catch((err) => console.error(err));

// });

//kpost routes
app.get('/kposts', getAllKposts);
app.post('/kpost', FBAuth, postOneKpost);
app.get('/kpost/:kpostId', getKpost);
app.post('/kpost/:kpostId/comment', FBAuth, commentOnKpost);
app.get('/kpost/:kpostId/like', FBAuth, likeKpost);
app.get('/kpost/:kpostId/unlike', FBAuth, unlikeKpost);
app.delete('/kpost/:kpostId', FBAuth, deleteKpost);
//TODO: delete kpost



app.use(cors);
//users routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);


// create new kpost
// exports.createKpost = functions.https.onRequest((req,res) =>{
//     if(req.method!=='POST'){
//         //to prevent client-side bad request by showing an error
//         //e.g. when client used GET instead of POST
//         //express will take care of this. 
//         return res.status(400).json({error: `Method not allowed. Bad Request`});
//     }
//     //create an object
//     const newKpost = {
//         body: req.body.body,
//         userhandle: req.body.userhandle,
//         createdAt: admin.firestore.Timestamp.fromDate(new Date())

//     };
//     //persist the newly created object in the database
//     admin.firestore()
//         .collection('kposts')
//         .add(newKpost)
//         .then(doc => {
//             res.json({message: `document ${doc.id} created successfully`});
//         })
//         .catch(err => {
//             res.status(500).json({error: `something went wrong`});
//             console.error(err);
//         })
// });

// using express





//     firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password)
//         .then(data=>{
//             return res.status(201)
//             .json({message: `user  ${data.user.uid} signed up successfully.`});
//         })
//         .catch((err)=>{
//             console.error(err);
//             return res.status(500).json({error: err.code});
//         });
// });



//https://baseurl.com/api/
exports.api = functions.https.onRequest(app);
exports.createNotificationOnLike = functions.region('us-central1').firestore.document('likes/{id}')
    .onCreate((snapshot) => {
        return db.doc(`/kposts/${snapshot.data().kpostId}`).get()
            .then(doc => {
                if (doc.exists && doc.data().userhandle !== snapshot.data().userhandle) {
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userhandle,
                        sender: snapshot.data().userhandle,
                        type: "like",
                        read: false,
                        kpostId: doc.id
                    })
                }
            })
            .catch(err =>
                console.error(err)
            );
    });

exports.deleteNotificationOnUnLike = functions.region('us-central1')
    .firestore.document('likes/{id}')
    .onDelete((snapshot) => {
        return db.doc(`/notifications/${snapshot.id}`)
            .delete()
            .catch((err) =>
                console.error(err)
            );
    })





exports.createNotificationOnComment = functions.region('us-central1')
    .firestore.document('comments/{id}')
    .onCreate((snapshot) => {
        return db.doc(`/kposts/${snapshot.data().kpostId}`).get()
            .then(doc => {
                if (doc.exists && doc.data().userhandle !== snapshot.data().userhandle) {
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userhandle,
                        sender: snapshot.data().userhandle,
                        type: "comment",
                        read: false,
                        kpostId: doc.id
                    })
                }
            })
            .catch(err =>
                console.error(err)
            );
    });

exports.onUserImageChange = functions.region('us-central1')
    .firestore.document('/users/{userId}')
    .onUpdate((change) => {
        console.log(change.before.data());
        console.log(change.after.data());

        if (change.before.data().imageUrl !== change.after.data().imageUrl) {
            const batch = db.batch();
            console.log('image has been updated...');
            return db.collection('kposts').where('userhandle', '==', change.before.data().handle).get()
                .then((data) => {
                    data.forEach(doc => {
                        const kpost = db.doc(`/kposts/${doc.id}`);
                        batch.update(kpost, { userImage: change.after.data().imageUrl });
                    })
                    return batch.commit();
                })
        }else{
            return true;
        }
    })

    exports.onKpostDelete= functions.region('us-central1')
    .firestore.document('/kposts/{kpostId}')
    .onDelete((snapshot, context) =>{
        const kpostId = context.params.kpostId;
        const batch = db.batch();
        return db.collection('comments').where('kpostId','==', kpostId).get()
        .then(data=>{
            data.forEach(doc=>{
                batch.delete(db.doc(`/comments/${doc.id}`));
            })
            return db.collection('likes').where('kpostId','==', kpostId).get();
        })
        .then(data=>{
            data.forEach(doc=>{
                batch.delete(db.doc(`/likes/${doc.id}`));
            })
            return db.collection('notifications').where('kpostId','==',kpostId).get();
        })
        .then(data=>{
            data.forEach(doc=>{
                batch.delete(db.doc(`/notifications/${doc.id}`));
            })
            return batch.commit();
        })
        .catch(err => console.error(err));
    })