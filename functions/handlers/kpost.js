
const { db } = require('../util/admin');

exports.getAllKposts = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    db
        .collection('kposts')
        .orderBy('createdAt', 'desc')
        .get()
        .then((data) => {
            let kposts = [];
            data.forEach((doc) => {
                kposts.push({
                    kpostId: doc.id,
                    body: doc.data().body,
                    userhandle: doc.data().userhandle,
                    createdAt: doc.data().createdAt,
                    commentCount: doc.data().commentCount,
                    likeCount: doc.data().likeCount,
                    userImage: doc.data().userImage
                });
            });
            return res.json(kposts);
        })
        .catch((err) => console.error(err));

}

exports.postOneKpost = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    // if(req.method!=='POST'){
    //to prevent client-side bad request by showing an error
    //e.g. when client used GET instead of POST
    //express will take care of this. 
    //    return res.status(400).json({error: `Method not allowed. Bad Request`});
    // }
    //create an object
    if (req.body.body.trim() === '') {
        return res.status(400).json({ body: 'Body must not be empty' });
    }
    const newKpost = {
        body: req.body.body,
        userhandle: req.user.handle,
        userImage: req.user.imageUrl,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0

    };
    //persist the newly created object in the database
    db
        .collection('kposts')
        .add(newKpost)
        .then(doc => {
            const resKpost = newKpost;
            resKpost.kpostid = doc.id;
            res.json(resKpost);
        })
        .catch(err => {
            res.status(500).json({ error: `something went wrong` });
            console.error(err);
        })
}

exports.getKpost = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    let kpostData = {};
    db.doc(`/kposts/${req.params.kpostId}`).get()
        .then(doc => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'Kpost not found' })
            }
            kpostData = doc.data();
            kpostData.kpostId = doc.id.trim();
            return db
                .collection('comments')
                .orderBy('createdAt', 'desc')
                .where('kpostId', '==', req.params.kpostId)
                .get();
        })
        .then(data => {
            kpostData.comments = [];
            data.forEach((doc) => {
                kpostData.comments.push(doc.data())
            });
            return res.json(kpostData);
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: err.code });
        })
}

//comment on a kpost
exports.commentOnKpost = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.body.body.trim() === '') 
        return res.status(400).json({ comment: 'Must not be empty' });
    const newComment = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        kpostId: req.params.kpostId,
        userhandle: req.user.handle,
        userImage: req.user.imageUrl
    };

    db.doc(`/kposts/${req.params.kpostId}`)
        .get()
        .then(doc => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'kpost not exist' });
            }
            return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
        })
        .then(() => {
            return db.collection('comments').add(newComment);
        })
        .then(() => {
            res.json(newComment);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: 'Something went wrong' });
        });
};

exports.likeKpost = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    //check if a like exist
    const likeDocument = db
        .collection('likes')
        .where('userhandle', '==', req.user.handle)
        .where('kpostId', '==', req.params.kpostId)
        .limit(1);


    const kpostDocument = db.doc(`/kposts/${req.params.kpostId}`);

    let kpostData;

    kpostDocument
        .get()
        .then((doc) => {
            if (doc.exists) {
                kpostData = doc.data();
                kpostData.kpostId = doc.id;
                return likeDocument.get();
            } else {
                return res.status(404).json({ error: 'Kpost not found' });
            }
        })
        .then((data) => {
            if (data.empty) {
                return db
                    .collection('likes')
                    .add({
                        kpostId: req.params.kpostId,
                        userhandle: req.user.handle
                    })
                    .then(() => {
                        kpostData.likeCount++;
                        return kpostDocument.update({ likeCount: kpostData.likeCount });
                    })
                    .then(() => {
                        return res.json(kpostData);
                    });
            } else {
                return res.status(400).json({ error: 'kpost already liked' });
            }
        })
        .catch((err) => {
            console.error(err);
            res.status(500).json({ error: err.code });
        });

};

exports.unlikeKpost = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    // //check if a like exist
    const likeDocument = db.collection('likes').where('userhandle', '==', req.user.handle)
        .where('kpostId', '==', req.params.kpostId).limit(1);

    const kpostDocument = db.doc(`/kposts/${req.params.kpostId}`);

    let kpostData;

    kpostDocument.get()
        .then(doc => {
            if (doc.exists) {
                kpostData = doc.data();
                kpostData.kpostId = doc.id;
                return likeDocument.get();
            } else {
                return res.status(404).json({ error: 'Kpost not found' });
            }
        })
        .then(data => {
            if (data.empty) {
                return res.status(400).json({ error: 'you cannot unlike a kpost you have not liked' });

            } else {
                return db.doc(`/likes/${data.docs[0].id}`)
                    .delete()
                    .then(() => {
                        kpostData.likeCount--;
                        return kpostDocument.update({ likeCount: kpostData.likeCount });
                    })
                    .then(() => {
                        res.json(kpostData);
                    })
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: err.code });
        });

}

exports.deleteKpost = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    const document = db.doc(`/kposts/${req.params.kpostId}`);
    //TODO: delete likes and comments as well
    const likeDocument = db.collection('likes')
        .where('kpostId', '==', req.params.kpostId);
    const commentDocument = db.collection('comments')
        .where('kpostId', '==', req.params.kpostId);
    document.get()
        .then(doc => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'Kpost does not exist' });
            }
            if (doc.data().userhandle !== req.user.handle) {
                return res.status(403).json({ error: 'Unauthorized' });
            } else {
                return document.delete();
                //TODO: delete likes and comments as well
            }
        })
        .then(() => {
            res.json({ message: 'Kpost deleted successfully' });
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        })
};

//makr notification read
exports.markNotificationsRead = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    //batch write
    let batch = db.batch();
    req.body.forEach((notificationId) => {
        const notification = db.doc(`/notifications/${notificationId}`);
        batch.update(notification, { read: true });
    });
    batch
        .commit()
        .then(() => {
            return res.json({ message: 'Notifications Marked As Read' });
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
};

