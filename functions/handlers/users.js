
const { admin, db } = require('../util/admin');

const config = require('../util/config');

const firebase = require('firebase');

firebase.initializeApp(config);

const { validateSignupData, validateLoginData, reduceUserDetails } = require('../util/validators')



exports.signup = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle

    };


    const { valid, errors } = validateSignupData(newUser);
    if (!valid) return res.status(400).json(errors);

    const noImg = 'no-img.png'

    //TODO: validate user
    //1:05:26
    let token, userId;
    db.doc(`/users/${newUser.handle}`).get()
        .then(doc => {
            if (doc.exists) {
                return res.status(400).json({ handle: ` this user name is already taken. Please create another one.` })
            } else {
                return firebase
                    .auth()
                    .createUserWithEmailAndPassword(newUser.email, newUser.password);
            }
        })
        .then((data) => {
            userId = data.user.uid;
            return data.user.getIdToken();
        })
        .then((idtoken) => {
            token = idtoken;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
                userId
            };
            db.doc(`/users/${newUser.handle}`).set(userCredentials);
            //return res.status(201).json({ token });
        })
        .then(() => {
            return res.status(201).json({ token });
        })
        .catch(err => {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                return res.status(400).json({ email: 'Email is already in use.' });

            } else {
                return res.status(500).json({ general: 'Something went wrong. Please try again.'});
            }
           // return res.status(500).json({ error: err.code });
        })
};

exports.login = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    const { valid, errors } = validateLoginData(user);
    if (!valid) return res.status(400).json(errors);

    firebase
        .auth()
        .signInWithEmailAndPassword(user.email, user.password)
        .then((data) => {
            return data.user.getIdToken();
        })
        .then((token) => {
  
            return res.json({ token });
        })
        .catch((err) => {
           
            console.error(err);
            // auth/wrong-password
            // auth/user-not-found
            return res
                .status(403)
                .json({ general: 'Wrong credentials, please try again' });
        });
};

//Add user details
exports.addUserDetails = (req, res) => {

    res.set('Access-Control-Allow-Origin', '*');

    let userDetails = reduceUserDetails(req.body);
    db.doc(`/users/${req.user.handle}`).update(userDetails)
        .then(() => {
            return res.json({ message: 'details added successfully' });
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
};
//get any user details
exports.getUserDetails = (req, res) =>{

    res.set('Access-Control-Allow-Origin', '*');

    let userData = {};
    db.doc(`users/${req.params.handle}`).get()
    .then(doc=>{
        if(doc.exists){
            userData.user = doc.data();
            return db.collection('kposts').where('userhandle','==',req.params.handle)
            .orderBy('createdAt', 'desc')
            .get();
        }else{
            return res.status(404).json({ error: 'User Not Found'});
        }
    })
    .then(data=>{
        userData.kposts = [];
        data.forEach(doc=>{
            userData.kposts.push({
                body: doc.data().body,
                createdAt: doc.data().createdAt,
                userhandle: doc.data().userhandle,
                userImage: doc.data().userImage,
                likeCount: doc.data().likeCount,
                commentCount: doc.data().commentCount,
                kpostId: doc.id

            })
        });
        return res.json(userData);
    })
    .catch(err =>{
        console.error(err);
        return res.status(500).json({ error: err.code });
    })
};
//get own user details
exports.getAuthenticatedUser = (req, res) =>{
    res.set('Access-Control-Allow-Origin', '*');

    let userData = {};
    db.doc(`/users/${req.user.handle}`).get()
    .then(doc => {
        if(doc.exists){
            userData.credentials = doc.data();
            return db.collection('likes').where('userHandle', '==', req.user.handle).get()

        }
    })
    .then(data => {
        userData.likes = [];
        data.forEach(doc => {
            userData.likes.push(doc.data());
        });
        //return res.json(userData);
        return db.collection('notifications').where('recipient','==',req.user.handle)
        .orderBy('createdAt','desc').limit(10).get();
    })
    .then(data=>{
        userData.notifications = [];
        data.forEach(doc=>{
            userData.notifications.push({
                recipient: doc.data().recipient,
                sender: doc.data().sender,
                createdAt: doc.data().createdAt,
                kpostId: doc.data().kpostId,
                type: doc.data().type,
                read: doc.data().read,
                notificationId: doc.id
            })
        });
        return res.json(userData);
    })
    .catch((err)=>{
        console.error(err);
        return res.status(500).json({error:err.code});
    })
};
//need a package called
//npm install --save busboy
exports.uploadImage = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const busboy = new BusBoy({ headers: req.headers });

    let imageFileName;
    let imageToBeUploaded = {};
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        //image.png (extract)
        console.log(fieldname);
        console.log(filename);
        console.log(mimetype);
        if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
            return res.status(400).json({ error: 'Wrong file type submitted' });
        }
        imageExtension = filename.split('.')[filename.split('.').length - 1];
        imageFileName = `${Math.round(Math.random() * 100000000000)}.${imageExtension}`;
        const filepath = path.join(os.tmpdir(), imageFileName);
        imageToBeUploaded = { filepath, mimetype };
        file.pipe(fs.createWriteStream(filepath));

    });

    busboy.on('finish', () => {
        admin
            .storage()
            .bucket("gs://klogs-61e15.appspot.com/")
            .upload(imageToBeUploaded.filepath, {
                resumable: false,
                metadata: {
                    metadata: {
                        contentType: imageToBeUploaded.mimetype
                    }
                }
            })
            .then(() => {
                const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
                //alt=media displays instead of downloads
                return db.doc(`/users/${req.user.handle}`)
                    .update({ imageUrl });
            })
            .then(() => {
                return res.json({ message: 'Image uploaded successfully' });
            })
            .catch(err => {
                console.error(err);
                return res.status(500).json({ error: err.code });
            });
    });
    busboy.end(req.rawBody);
};

exports.markNotificationsRead = (req,res) =>{
    res.set('Access-Control-Allow-Origin', '*');
    let batch = db.batch();
    req.body.forEach(notificationId =>{
        const notification = db.doc(`/notifications/${notificationId}`);
        batch.update(notification,{read: true});

    });
    batch.commit()
    .then(()=>{
        return res.json({message: 'Notifications marked read'});
    })
    .catch(err=>{
        console.error(err);
        return res.status(500).json({error: err.code});
    });
};